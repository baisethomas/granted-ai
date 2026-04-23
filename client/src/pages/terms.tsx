import MarketingHeader from "@/components/layout/marketing-header";
import { Footer } from "@/components/landing/footer";

export default function Terms() {
  const lastUpdated = "April 22, 2026";

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(105deg, #f9fafb 0%, #eef2f7 80%, #f6ede7 100%)" }}
    >
      <MarketingHeader />
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6">
          <span className="inline-block mb-4 rounded-lg border border-white/10 px-3 py-1">
            <span className="uppercase tracking-widest text-xs font-bold text-blue-500">Legal</span>
          </span>
          <h1 className="mb-4 text-gray-900 font-normal leading-tight tracking-tight text-4xl sm:text-5xl">
            Terms of Service
          </h1>
          <p className="text-sm text-slate-500 mb-10">Last updated: {lastUpdated}</p>

          <div className="prose prose-slate max-w-none bg-white/80 rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6 text-slate-700">
            <p>
              These Terms of Service ("Terms") govern your access to and use of the websites,
              applications, and services provided by Granted ("Granted," "we," "us," or "our")
              (collectively, the "Service"). By accessing or using the Service, you agree to be
              bound by these Terms. If you do not agree, do not use the Service.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">1. Eligibility and Accounts</h2>
            <p>
              You must be at least 18 years old and capable of forming a binding contract to use
              the Service. When you create an account, you agree to provide accurate information
              and to keep it up to date. You are responsible for safeguarding your credentials and
              for all activity that occurs under your account.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">2. Use of the Service</h2>
            <p>
              We grant you a limited, non-exclusive, non-transferable, revocable license to access
              and use the Service for your internal business purposes, subject to these Terms. You
              agree not to:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Use the Service in violation of any applicable law or regulation;</li>
              <li>Infringe the intellectual property or other rights of any third party;</li>
              <li>
                Upload or transmit any content that is unlawful, harmful, defamatory, or otherwise
                objectionable;
              </li>
              <li>
                Attempt to interfere with, disrupt, reverse engineer, or gain unauthorized access to
                the Service or its underlying systems;
              </li>
              <li>
                Use the Service to build a competing product or to train machine learning models
                without our prior written consent.
              </li>
            </ul>

            <h2 className="text-xl font-semibold text-slate-900">3. Your Content</h2>
            <p>
              You retain all rights in the content you upload or submit to the Service ("Your
              Content"). By submitting Your Content, you grant us a worldwide, non-exclusive,
              royalty-free license to host, copy, transmit, display, and process Your Content
              solely as necessary to provide, maintain, and improve the Service for you. You are
              responsible for ensuring that you have all rights necessary to submit Your Content to
              the Service.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">4. AI-Generated Output</h2>
            <p>
              The Service uses third-party AI models to generate output based on Your Content and
              inputs. AI output may be inaccurate, incomplete, or otherwise unsuitable for a
              particular purpose, and similar or identical output may be generated for other users.
              You are solely responsible for reviewing, editing, and verifying any AI-generated
              output before relying on it or submitting it to a funder or other third party.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">5. Payments and Subscriptions</h2>
            <p>
              Paid plans are billed in advance on a recurring basis. Fees are non-refundable except
              where required by law. We may change our fees at any time by providing notice through
              the Service or by email. Your continued use of a paid plan after a fee change
              constitutes acceptance of the new fees.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">6. Intellectual Property</h2>
            <p>
              The Service, including all related software, designs, text, graphics, and trademarks,
              is owned by Granted or its licensors and is protected by intellectual property laws.
              Except for the limited license granted in these Terms, we reserve all rights in the
              Service.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">7. Third-Party Services</h2>
            <p>
              The Service may integrate with or rely on third-party services (such as authentication
              providers, payment processors, and AI model providers). We are not responsible for
              the availability, accuracy, or content of any third-party services, and your use of
              them is subject to their own terms and policies.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">8. Termination</h2>
            <p>
              You may stop using the Service at any time. We may suspend or terminate your access
              to the Service at any time, with or without notice, if we believe you have violated
              these Terms or if required to do so by law. Upon termination, your right to use the
              Service will cease immediately, and provisions that by their nature should survive
              termination will survive.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">9. Disclaimers</h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
              WHETHER EXPRESS OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS
              FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE
              WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT AI OUTPUT WILL BE ACCURATE OR
              RELIABLE.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">10. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, GRANTED AND ITS AFFILIATES, OFFICERS,
              EMPLOYEES, AND AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
              CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR
              GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY
              FOR ANY CLAIM ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE WILL NOT EXCEED
              THE AMOUNTS PAID BY YOU TO GRANTED IN THE TWELVE MONTHS PRECEDING THE EVENT GIVING
              RISE TO THE CLAIM, OR ONE HUNDRED U.S. DOLLARS ($100), WHICHEVER IS GREATER.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">11. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Granted and its affiliates from any
              claims, damages, liabilities, costs, and expenses (including reasonable attorneys'
              fees) arising out of or related to your use of the Service, Your Content, or your
              violation of these Terms or any applicable law.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">12. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the State of Delaware, United States, without
              regard to its conflict of laws principles. Any dispute arising out of or related to
              these Terms will be resolved exclusively in the state or federal courts located in
              Delaware, and you consent to personal jurisdiction there.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">13. Changes to These Terms</h2>
            <p>
              We may modify these Terms from time to time. If we make material changes, we will
              notify you through the Service or by email. Your continued use of the Service after
              the effective date of the updated Terms constitutes acceptance of the changes.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">14. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us at{" "}
              <a href="mailto:legal@granted.ai" className="text-blue-600 underline">
                legal@granted.ai
              </a>
              .
            </p>

            <p className="text-sm italic text-slate-500">
              This document is provided for general informational purposes only and does not
              constitute legal advice. You should consult qualified legal counsel before relying on
              it.
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
