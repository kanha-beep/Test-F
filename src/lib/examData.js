export const EXAM_TYPES = [
  "SSC",
  "UPSC",
  "MPPSC",
  "UPPSC",
  "BPSC",
  "RRB",
  "Banking",
  "Defence",
  "Teaching",
  "State PCS",
  "General"
];

export const PAGE_TYPES = [
  { value: "full-test", label: "Full Mock Test" },
  { value: "sectional", label: "Sectional Test" },
  { value: "pyq", label: "Previous Year Questions" },
  { value: "custom", label: "Custom Practice" }
];

export const EXAM_DETAILS = {
  SSC: {
    heading: "SSC preparation hub",
    description: "Quant, reasoning, English, and GS oriented papers tailored for SSC-style practice."
  },
  UPSC: {
    heading: "UPSC preparation hub",
    description: "General studies, polity, history, geography, economy, and analytical practice sets for UPSC aspirants."
  },
  MPPSC: {
    heading: "MPPSC preparation hub",
    description: "State-specific and general studies tests mapped for MPPSC-level revision."
  },
  UPPSC: {
    heading: "UPPSC preparation hub",
    description: "UP history, polity, current affairs, and mixed aptitude practice for UPPSC candidates."
  },
  BPSC: {
    heading: "BPSC preparation hub",
    description: "Bihar-focused and general merit test sets for BPSC learners."
  },
  RRB: {
    heading: "Railway/RRB hub",
    description: "Fast-practice reasoning, math, and general awareness sets useful for railway exams."
  },
  Banking: {
    heading: "Banking exam hub",
    description: "Aptitude, reasoning, English, and banking awareness practice in timed formats."
  },
  Defence: {
    heading: "Defence exam hub",
    description: "Mixed aptitude and subject-specific sets for CDS, NDA, and allied preparation."
  },
  Teaching: {
    heading: "Teaching exam hub",
    description: "Pedagogy, reasoning, language, and teaching aptitude drills for education exams."
  },
  "State PCS": {
    heading: "State PCS hub",
    description: "A reusable structure for state public service commission exam practice."
  },
  General: {
    heading: "General exam hub",
    description: "Flexible mixed practice papers for any learner not tied to one exam family."
  }
};

export function pageTypeLabel(value) {
  return PAGE_TYPES.find((item) => item.value === value)?.label || "Custom Practice";
}
