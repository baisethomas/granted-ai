import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export function FAQSection() {
  const faqs = [
    {
      question: "How does Granted use our documents?",
      answer: "We build a private, per-organization knowledge base to tailor responses. Your content is not shared or used for public model training.",
    },
    {
      question: "Can we keep multiple draft versions?",
      answer: "Yes—versioning is built in. Mark a version as current any time and export when ready.",
    },
    {
      question: "Do you support team collaboration?",
      answer: "Collaboration is on the roadmap; today, you can iterate quickly and export drafts for review.",
    },
  ];

  return (
    <section className="py-16">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-2xl font-semibold text-slate-900 text-center">
          Frequently asked questions
        </h2>
        <Accordion type="single" collapsible className="mt-6">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index + 1}`}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}