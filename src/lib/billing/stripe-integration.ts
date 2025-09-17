import Stripe from 'stripe';
import { supabaseBrowserClient } from '../supabase/client';
import { createServerSupabaseClient } from '../supabase/server';
import { PLAN_PRICING } from './billing-engine';

export interface StripeConfig {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
}

export interface SubscriptionDetails {
  id: string;
  customerId: string;
  status: Stripe.Subscription.Status;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  planId: string;
  quantity: number;
  amount: number; // in cents
  interval: 'month' | 'year';
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
}

export interface PaymentMethod {
  id: string;
  type: string;
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

export interface StripeCustomer {
  id: string;
  email?: string;
  name?: string;
  organizationId: string;
  paymentMethods: PaymentMethod[];
  subscription?: SubscriptionDetails;
}

export class StripeService {
  private static instance: StripeService;
  private stripe: Stripe | null = null;
  private supabase: any;

  private constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (secretKey) {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2023-10-16',
      });
    }
    
    this.supabase = typeof window !== 'undefined' 
      ? supabaseBrowserClient 
      : createServerSupabaseClient();
  }

  static getInstance(): StripeService {
    if (!StripeService.instance) {
      StripeService.instance = new StripeService();
    }
    return StripeService.instance;
  }

  /**
   * Create a Stripe customer for an organization
   */
  async createCustomer(organizationId: string, email: string, name: string): Promise<string> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: {
          organizationId,
        },
      });

      // Update organization with customer ID
      const { error } = await this.supabase
        .from('organizations')
        .update({ billing_customer_id: customer.id })
        .eq('id', organizationId);

      if (error) {
        console.error('Failed to update organization with customer ID:', error);
        throw new Error('Failed to link customer to organization');
      }

      return customer.id;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  /**
   * Create subscription for a customer
   */
  async createSubscription(
    customerId: string,
    planId: string,
    billing: 'monthly' | 'yearly' = 'monthly',
    trialDays?: number
  ): Promise<SubscriptionDetails> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    try {
      // Create Stripe price for the plan if it doesn't exist
      const priceId = await this.getOrCreatePrice(planId, billing);

      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent', 'customer'],
      };

      if (trialDays) {
        subscriptionParams.trial_period_days = trialDays;
      }

      const subscription = await this.stripe.subscriptions.create(subscriptionParams);

      return this.formatSubscriptionDetails(subscription);
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Update subscription (change plan, quantity, etc.)
   */
  async updateSubscription(
    subscriptionId: string,
    updates: {
      planId?: string;
      quantity?: number;
      billing?: 'monthly' | 'yearly';
      prorate?: boolean;
    }
  ): Promise<SubscriptionDetails> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      const updateParams: Stripe.SubscriptionUpdateParams = {
        proration_behavior: updates.prorate !== false ? 'create_prorations' : 'none',
      };

      if (updates.planId && updates.billing) {
        const newPriceId = await this.getOrCreatePrice(updates.planId, updates.billing);
        updateParams.items = [{
          id: subscription.items.data[0].id,
          price: newPriceId,
          quantity: updates.quantity,
        }];
      } else if (updates.quantity) {
        updateParams.items = [{
          id: subscription.items.data[0].id,
          quantity: updates.quantity,
        }];
      }

      const updatedSubscription = await this.stripe.subscriptions.update(subscriptionId, updateParams);
      
      return this.formatSubscriptionDetails(updatedSubscription);
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, immediately: boolean = false): Promise<SubscriptionDetails> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    try {
      let subscription;
      
      if (immediately) {
        subscription = await this.stripe.subscriptions.cancel(subscriptionId);
      } else {
        subscription = await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
      }

      return this.formatSubscriptionDetails(subscription);
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Get customer details including subscription and payment methods
   */
  async getCustomer(customerId: string): Promise<StripeCustomer | null> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    try {
      const [customer, subscriptions, paymentMethods] = await Promise.all([
        this.stripe.customers.retrieve(customerId),
        this.stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 }),
        this.stripe.paymentMethods.list({ customer: customerId, type: 'card' }),
      ]);

      if (customer.deleted) {
        return null;
      }

      const formattedPaymentMethods: PaymentMethod[] = paymentMethods.data.map(pm => ({
        id: pm.id,
        type: pm.type,
        last4: pm.card?.last4,
        brand: pm.card?.brand,
        expiryMonth: pm.card?.exp_month,
        expiryYear: pm.card?.exp_year,
        isDefault: pm.id === customer.invoice_settings?.default_payment_method,
      }));

      const subscription = subscriptions.data[0] 
        ? this.formatSubscriptionDetails(subscriptions.data[0])
        : undefined;

      return {
        id: customer.id,
        email: customer.email || undefined,
        name: customer.name || undefined,
        organizationId: customer.metadata?.organizationId || '',
        paymentMethods: formattedPaymentMethods,
        subscription,
      };
    } catch (error) {
      console.error('Error getting customer:', error);
      throw error;
    }
  }

  /**
   * Create a setup intent for adding payment method
   */
  async createSetupIntent(customerId: string): Promise<{ clientSecret: string }> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    try {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
      });

      return { clientSecret: setupIntent.client_secret! };
    } catch (error) {
      console.error('Error creating setup intent:', error);
      throw error;
    }
  }

  /**
   * Get or create Stripe price for a plan
   */
  private async getOrCreatePrice(planId: string, billing: 'monthly' | 'yearly'): Promise<string> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    const planPricing = PLAN_PRICING[planId];
    if (!planPricing) {
      throw new Error(`Invalid plan: ${planId}`);
    }

    const amount = billing === 'yearly' ? planPricing.yearlyPrice : planPricing.monthlyPrice;
    const interval = billing === 'yearly' ? 'year' : 'month';
    
    // Look for existing price
    const existingPrices = await this.stripe.prices.list({
      product: planId,
      active: true,
      recurring: { interval },
      unit_amount: amount,
      limit: 1,
    });

    if (existingPrices.data.length > 0) {
      return existingPrices.data[0].id;
    }

    // Create product if it doesn't exist
    let product;
    try {
      product = await this.stripe.products.retrieve(planId);
    } catch (error) {
      product = await this.stripe.products.create({
        id: planId,
        name: planPricing.name,
        description: `${planPricing.name} plan for Granted AI`,
        metadata: {
          plan: planId,
          features: JSON.stringify(planPricing.features),
        },
      });
    }

    // Create price
    const price = await this.stripe.prices.create({
      product: product.id,
      unit_amount: amount,
      currency: 'usd',
      recurring: { interval },
      metadata: {
        plan: planId,
        billing,
      },
    });

    return price.id;
  }

  /**
   * Format Stripe subscription to our format
   */
  private formatSubscriptionDetails(subscription: Stripe.Subscription): SubscriptionDetails {
    const item = subscription.items.data[0];
    const price = item.price;
    
    return {
      id: subscription.id,
      customerId: subscription.customer as string,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      planId: price.metadata?.plan || 'unknown',
      quantity: item.quantity || 1,
      amount: price.unit_amount || 0,
      interval: price.recurring?.interval === 'year' ? 'year' : 'month',
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(body: string, signature: string): Promise<void> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret not configured');
    }

    try {
      const event = this.stripe.webhooks.constructEvent(body, signature, webhookSecret);

      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionChange(event.data.object as Stripe.Subscription);
          break;
          
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
          
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;
          
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;
          
        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }

  /**
   * Handle subscription creation/updates
   */
  private async handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
    try {
      const customerId = subscription.customer as string;
      const customer = await this.stripe!.customers.retrieve(customerId);
      
      if (customer.deleted) {
        console.error('Customer was deleted');
        return;
      }

      const organizationId = customer.metadata?.organizationId;
      if (!organizationId) {
        console.error('No organization ID found in customer metadata');
        return;
      }

      const item = subscription.items.data[0];
      const planId = item.price.metadata?.plan || 'starter';

      // Update organization plan
      const { error: orgError } = await this.supabase
        .from('organizations')
        .update({ 
          plan: planId,
          billing_customer_id: customerId,
        })
        .eq('id', organizationId);

      if (orgError) {
        console.error('Failed to update organization plan:', orgError);
      }

      // Update/create subscription record
      const subscriptionDetails = this.formatSubscriptionDetails(subscription);
      const { error: subError } = await this.supabase
        .from('subscriptions')
        .upsert({
          organization_id: organizationId,
          plan: planId,
          status: subscription.status === 'active' ? 'active' : subscription.status,
          renewal_at: subscriptionDetails.currentPeriodEnd.toISOString(),
          seats: item.quantity || 1,
          provider_customer_id: customerId,
        });

      if (subError) {
        console.error('Failed to update subscription record:', subError);
      }
    } catch (error) {
      console.error('Error handling subscription change:', error);
    }
  }

  /**
   * Handle subscription deletion
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    try {
      const customerId = subscription.customer as string;
      const customer = await this.stripe!.customers.retrieve(customerId);
      
      if (customer.deleted) {
        return;
      }

      const organizationId = customer.metadata?.organizationId;
      if (!organizationId) {
        return;
      }

      // Downgrade to starter plan
      const { error: orgError } = await this.supabase
        .from('organizations')
        .update({ plan: 'starter' })
        .eq('id', organizationId);

      if (orgError) {
        console.error('Failed to downgrade organization:', orgError);
      }

      // Update subscription status
      const { error: subError } = await this.supabase
        .from('subscriptions')
        .update({ status: 'canceled' })
        .eq('organization_id', organizationId);

      if (subError) {
        console.error('Failed to update subscription status:', subError);
      }
    } catch (error) {
      console.error('Error handling subscription deletion:', error);
    }
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    // Could be used to send receipt emails, update payment history, etc.
    console.log(`Payment succeeded for invoice ${invoice.id}`);
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    // Could be used to send dunning emails, suspend service, etc.
    console.log(`Payment failed for invoice ${invoice.id}`);
  }

  /**
   * Get billing portal URL for customer self-service
   */
  async createBillingPortalSession(customerId: string, returnUrl: string): Promise<string> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      return session.url;
    } catch (error) {
      console.error('Error creating billing portal session:', error);
      throw error;
    }
  }

  /**
   * Create checkout session for subscription signup
   */
  async createCheckoutSession(
    customerId: string,
    planId: string,
    billing: 'monthly' | 'yearly',
    successUrl: string,
    cancelUrl: string,
    trialDays?: number
  ): Promise<string> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    try {
      const priceId = await this.getOrCreatePrice(planId, billing);
      
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: {
          metadata: {
            plan: planId,
            billing,
          },
        },
      };

      if (trialDays) {
        sessionParams.subscription_data!.trial_period_days = trialDays;
      }

      const session = await this.stripe.checkout.sessions.create(sessionParams);
      
      return session.url!;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }
}

export const stripeService = StripeService.getInstance();