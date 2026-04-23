import MarketingHeader from "@/components/layout/marketing-header";
import { Footer } from "@/components/landing/footer";

export default function Privacy() {
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
            Privacy Policy
          </h1>
          <p className="text-sm text-slate-500 mb-10">Last updated: {lastUpdated}</p>

          <div className="prose prose-slate max-w-none bg-white/80 rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6 text-slate-700">
            <p>
              This Privacy Policy describes how Granted ("we," "us," or "our") collects, uses, and
              discloses information about you when you use our website, applications, and services
              (collectively, the "Service"). By using the Service, you agree to the collection and
              use of information in accordance with this policy.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">1. Information We Collect</h2>
            <p>
              We collect information you provide directly to us, such as when you create an account,
              upload documents, submit grant questions, or communicate with us. This may include
              your name, email address, organization details, payment information, and any content
              you choose to upload or generate through the Service.
            </p>
            <p>
              We also automatically collect certain information when you use the Service, including
              log data, device information, IP address, browser type, and usage data. We may use
              cookies and similar tracking technologies to collect this information.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide, maintain, and improve the Service;</li>
              <li>Process transactions and send related information;</li>
              <li>Generate AI-assisted grant responses based on your uploaded content;</li>
              <li>Communicate with you about products, services, and updates;</li>
              <li>Monitor and analyze trends, usage, and activities;</li>
              <li>Detect, investigate, and prevent fraudulent or unauthorized activity;</li>
              <li>Comply with legal obligations.</li>
            </ul>

            <h2 className="text-xl font-semibold text-slate-900">3. Sharing of Information</h2>
            <p>
              We do not sell your personal information. We may share information with third-party
              vendors and service providers that perform services on our behalf, such as cloud
              hosting, payment processing, analytics, and AI model providers. We may also disclose
              information to comply with applicable law, regulation, legal process, or governmental
              request, or to protect the rights, property, and safety of Granted, our users, or
              others.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">4. AI and Content Processing</h2>
            <p>
              Content you upload or submit to the Service may be processed by third-party AI
              providers (such as OpenAI and Anthropic) solely for the purpose of generating
              responses on your behalf. We take reasonable steps to select providers with
              appropriate data handling practices. We do not use your content to train foundation
              models without your consent.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">5. Data Retention</h2>
            <p>
              We retain personal information for as long as necessary to provide the Service and
              fulfill the purposes described in this policy, unless a longer retention period is
              required or permitted by law. You may request deletion of your account and associated
              data at any time.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">6. Security</h2>
            <p>
              We implement reasonable technical and organizational measures designed to protect your
              information. However, no method of transmission over the Internet or electronic
              storage is completely secure, and we cannot guarantee absolute security.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">7. Your Rights and Choices</h2>
            <p>
              Depending on your jurisdiction, you may have rights to access, correct, delete, or
              export your personal information, and to object to or restrict certain processing. To
              exercise these rights, please contact us using the details below.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">8. Children's Privacy</h2>
            <p>
              The Service is not directed to children under 13, and we do not knowingly collect
              personal information from children under 13. If you believe we have collected such
              information, please contact us so we can delete it.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">9. International Users</h2>
            <p>
              The Service is operated from the United States. If you are accessing the Service from
              outside the United States, your information may be transferred to, stored, and
              processed in the United States or other countries where our service providers operate.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. If we make material changes, we
              will notify you by posting the updated policy on this page and updating the "Last
              updated" date above.
            </p>

            <h2 className="text-xl font-semibold text-slate-900">11. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at{" "}
              <a href="mailto:privacy@granted.ai" className="text-blue-600 underline">
                privacy@granted.ai
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
