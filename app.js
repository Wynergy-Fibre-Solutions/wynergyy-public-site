// ACE — Authoritative Controlled Explainer (UI-only, deterministic)

const aceQuestions = [
  {
    q: "What is Wynergy Fibre Solutions Ltd?",
    a: "Wynergy Fibre Solutions Ltd is a UK-based infrastructure and systems company operating in regulated and compliance-sensitive environments."
  },
  {
    q: "What does the company focus on?",
    a: "The company focuses on governance-first system design, operational integrity, and long-term auditability."
  },
  {
    q: "What is shown on this site?",
    a: "This site presents public, non-operational information only. Core systems and proprietary methods are not disclosed."
  },
  {
    q: "What is ACE?",
    a: "ACE is an Authoritative Controlled Explainer. It presents verified public information only. It is not a chatbot and does not provide advice."
  },
  {
    q: "Why are core systems private?",
    a: "Keeping core systems private protects intellectual property, reduces operational risk, and aligns with best practice in regulated sectors."
  },
  {
    q: "Is this an AI company?",
    a: "No. The company does not build consumer AI tools. It designs governed, deterministic information surfaces suitable for regulated environments."
  },
  {
    q: "Is anything open source?",
    a: "Selective, non-operational artefacts may be public. Core governance and operational systems are not open source."
  },
  {
    q: "Who is this built for?",
    a: "Infrastructure operators, regulated organisations, partners, and stakeholders requiring assurance and auditability."
  },
  {
    q: "How can partners or investors engage?",
    a: "Public information is available on this site. Further engagement is considered selectively through appropriate channels."
  }
];

const aceModal = document.createElement("div");
aceModal.id = "ace-modal";
aceModal.style.display = "none";
aceModal.innerHTML = `
  <div class="ace-content">
    <h2>ACE — Authoritative Controlled Explainer</h2>
    <div id="ace-qa"></div>
    <button id="closeAce">Close</button>
  </div>
`;
document.body.appendChild(aceModal);

const qaContainer = aceModal.querySelector("#ace-qa");
aceQuestions.forEach(item => {
  const block = document.createElement("div");
  block.className = "ace-block";
  block.innerHTML = `<strong>${item.q}</strong><p>${item.a}</p>`;
  qaContainer.appendChild(block);
});

document.getElementById("openAce").addEventListener("click", () => {
  aceModal.style.display = "block";
});

document.getElementById("closeAce").addEventListener("click", () => {
  aceModal.style.display = "none";
});
