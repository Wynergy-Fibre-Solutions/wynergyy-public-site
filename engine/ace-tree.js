/**
 * ACE Tree (bounded disclosure)
 * Keep this short and governed. Expand by adding nodes, not by making text longer.
 * Targets must be node keys.
 */

export const ACE_TREE = {
  root: {
    t: "Hello. Choose a topic to explore WFSL.",
    o: [
      ["About WFSL", "about"],
      ["Engagement", "engage"],
      ["Telecoms delivery", "telecoms"],
      ["Governance & compliance", "gov"],
      ["Business value", "value"],
    ],
  },

  about: {
    t: "WFSL builds governance-first telecoms and infrastructure capability for regulated environments.",
    o: [
      ["What we do", "about_do"],
      ["How we operate", "about_how"],
      ["Back to start", "root"],
    ],
  },
  about_do: {
    t: "We deliver structured fibre and civils pathways, with governed operational controls and traceability.",
    o: [
      ["Telecoms delivery", "telecoms"],
      ["Governance & compliance", "gov"],
      ["Back", "about"],
    ],
  },
  about_how: {
    t: "Public disclosure is intentional. Core systems are controlled and disclosed selectively under NDA.",
    o: [
      ["Engagement", "engage"],
      ["Request NDA", "nda"],
      ["Back", "about"],
    ],
  },

  engage: {
    t: "Engagement is structured. We verify parties and scope before controlled disclosure or onboarding.",
    o: [
      ["Work with us", "work"],
      ["Request NDA", "nda"],
      ["Engineer or contractor", "path_worker"],
      ["Partner or client", "path_partner"],
      ["Investor or lender", "path_investor"],
      ["Back to start", "root"],
    ],
  },

  work: {
    t: "WFSL engages via verified pathways. Intake is controlled. Outcomes are governed.",
    o: [
      ["Engineer or contractor", "path_worker"],
      ["Partner or client", "path_partner"],
      ["Back", "engage"],
    ],
  },

  nda: {
    t: "NDA access is issued after verified expression of interest and scope confirmation.",
    o: [
      ["Back", "engage"],
      ["Back to start", "root"],
    ],
  },

  telecoms: {
    t: "Delivery spans fibre builds, civils interfaces and managed infrastructure pathways.",
    o: [
      ["Business value", "value"],
      ["Engagement", "engage"],
      ["Back to start", "root"],
    ],
  },

  gov: {
    t: "All engagement operates within lawful, auditable and controlled governance frameworks.",
    o: [
      ["Regulatory reference", "gov_reference"],
      ["Business value", "value"],
      ["Back to start", "root"],
    ],
  },

  gov_reference: {
    t: "Regulatory references can be linked at the surface layer. The core engine stays UI-agnostic.",
    o: [
      ["Back", "gov"],
      ["Back to start", "root"],
    ],
  },

  value: {
    t: "WFSL reduces delivery risk, improves compliance confidence and enables licensable operational capability.",
    o: [
      ["Assets & licensing", "assets"],
      ["Engagement", "engage"],
      ["Back to start", "root"],
    ],
  },

  assets: {
    t: "Assets include governed processes, delivery capability and controlled software systems. Disclosure remains bounded.",
    o: [
      ["Request NDA", "nda"],
      ["Back", "value"],
      ["Back to start", "root"],
    ],
  },

  /* --------------------------- Pathway nodes --------------------------- */

  path_worker: {
    t: "Worker pathway. Choose what you need.",
    o: [
      ["Onboarding requirements", "worker_requirements"],
      ["Compliance evidence", "worker_compliance"],
      ["Back", "engage"],
      ["Back to start", "root"],
    ],
  },
  worker_requirements: {
    t: "Requirements are verified per role and project. Certification, right to work and competency evidence may be required.",
    o: [
      ["Compliance evidence", "worker_compliance"],
      ["Back", "path_worker"],
    ],
  },
  worker_compliance: {
    t: "WFSL verifies certificates and compliance evidence through controlled workflows before deployment.",
    o: [
      ["Back", "path_worker"],
      ["Back to start", "root"],
    ],
  },

  path_partner: {
    t: "Partner pathway. Choose an outcome.",
    o: [
      ["Delivery capability", "partner_delivery"],
      ["Governance & compliance", "gov"],
      ["Request NDA", "nda"],
      ["Back", "engage"],
    ],
  },
  partner_delivery: {
    t: "WFSL supports structured delivery with verification, governance and controlled reporting surfaces.",
    o: [
      ["Engagement", "engage"],
      ["Back", "path_partner"],
    ],
  },

  path_investor: {
    t: "Investor or lender pathway. We provide governed confidence, bounded disclosure and controlled evidence under NDA.",
    o: [
      ["Business value", "value"],
      ["Request NDA", "nda"],
      ["Back", "engage"],
    ],
  },
};
