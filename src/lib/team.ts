export type TeamMember = {
  name: string;
  role: "Partner" | "ManagingPartner" | "Tax" | "OfficeProjectManager" | "SeniorAccountant" | "Associate";
  profilePic: string;
  social: {
    linkedin: string;
  };
  bioShort: string;
  bioLong?: string;
  pbmUrl?: string;
  education?: string[];
  languages?: string[];
  memberships?: string[];
  credentials?: string[];
};

export const teamMembers: TeamMember[] = [
  {
    name: "Hassan Barbir",
    role: "Partner",
    profilePic: "/assets/team/hb.webp",
    social: {
      linkedin: "https://www.linkedin.com/in/hassanbarbir",
    },
    bioShort: "Partner at Ark Fiduciaire. Focus on corporate structuring, governance and cross‑border matters.",
    bioLong:
      "Hassan advises on corporate structuring, tax‑efficient reorganizations and governance for growth‑stage and international groups. Admitted to the bar in 2013 and holding an LL.M. in Tax (University of Geneva), he combines pragmatic deal execution with cross‑border coordination. He works in French, English and Italian.",
    pbmUrl: "https://pbm.law/fr/team/hassan-barbir",
    education: [
      "LL.M. Tax, University of Geneva",
      "Master in Law, University of Geneva",
      "Bachelor in Law, University of Geneva",
    ],
    languages: ["French", "English", "Italian"],
    memberships: ["ODAGE", "FSA"],
    credentials: ["Admitted to the Geneva bar (2013)"],
  },
  {
    name: "Samuel Halff",
    role: "ManagingPartner",
    profilePic: "/assets/team/sh.webp",
    social: {
      linkedin: "https://www.linkedin.com/in/samuelhalff",
    },
    bioShort: "Managing partner at Ark Fiduciaire. Finance, M&A and operations oriented.",
    bioLong:
      "Samuel focuses on finance operations, M&A readiness and leadership reporting. Admitted to the bar in 2013 and holder of an LL.M. from UCLA (2019–2020), he helps teams put in place reliable data, processes and governance that scale through transactions. He works in French, English and German.",
    pbmUrl: "https://pbm.law/fr/team/samuel-halff",
    education: [
      "LL.M., UCLA (University of California, Los Angeles)",
      "Master in Law, University of Geneva",
    ],
    languages: ["French", "English"],
    credentials: ["Admitted to the Genevabar (2013)"],
  },
  {
    name: "Rodrigue Sperisen",
    role: "Partner",
    profilePic: "/assets/team/rs.webp",
    social: {
      linkedin: "https://www.linkedin.com/in/rodrigue-sperisen-74543a185",
    },
    bioShort: "Partner at Ark Fiduciaire. Accounting and finance operations specialist.",
    bioLong:
      "Rodrigue is a TEP‑qualified lawyer (STEP Diploma, 2009; bar 2005) who designs robust ownership, governance and succession frameworks for companies and founders. He brings trust and estate structuring experience and builds clear, decision‑ready reporting with sound processes and tooling. He works in French and English.",
    pbmUrl: "https://pbm.law/fr/team/rodrigue-sperisen",
    education: ["Master in Law, University of Neuchâtel"],
    languages: ["French", "English"],
    memberships: [
      "ODAGE",
      "FSA",
      "OAR SFA-FSN",
      "STEP",
      "ASDS",
      "Fondation pour le droit de l'art",
    ],
    credentials: ["Admitted to the Geneva bar (2005)", "STEP Diploma (2009)"],
  },
  {
    name: "Lassana Dioum",
    role: "Partner",
    profilePic: "/assets/team/ld.webp",
    social: {
      linkedin: "https://www.linkedin.com/in/lassana-dioum-b429622b",
    },
    bioShort: "Partner at Ark Fiduciaire. Tax, payroll and compliance for SMEs and international teams.",
    bioLong:
      "Lassana leads tax, payroll and compliance programs for SMEs and international teams. Admitted to the bar in 2012 and graduate in economic law (University of Geneva), he coordinates filings, rulings and process implementation across jurisdictions with a focus on practical, people‑friendly execution. He works in French, English and Spanish.",
    pbmUrl: "https://pbm.law/fr/team/lassana-dioum",
    education: [
      "Master in Economic Law, University of Geneva",
      "Bachelor in Law, University of Geneva",
      "HEC, University of Geneva",
    ],
    languages: ["French", "English", "Spanish"],
    memberships: ["ODAGE", "FSA", "IBA", "IFA", "AIJA"],
    credentials: ["Admitted to the Geneva bar (2012)"],
  },
  {
    name: "Anthony Touboul",
    role: "Tax",
    profilePic: "/assets/team/at.webp",
    social: {
      linkedin: "https://ch.linkedin.com/in/touboulanthony",
    },
    bioShort: "Tax specialist supporting individuals and companies with Swiss and international tax compliance.",
    pbmUrl: "https://pbm.law/fr/team/anthony-touboul",
  },
  {
    name: "Celeste Leal",
    role: "OfficeProjectManager",
    profilePic: "/assets/team/cl.webp",
    social: {
      linkedin: "https://www.linkedin.com/in/c%C3%A9lesteleal",
    },
    bioShort: "Leads office operations and projects, ensuring smooth onboarding and efficient internal processes.",
    pbmUrl: "https://pbm.law/fr/team/celeste-leal",
  },
  {
    name: "Sébastien Gallié",
    role: "SeniorAccountant",
    profilePic: "/assets/missing-profile.svg",
    social: {
      linkedin: "https://ch.linkedin.com/in/s%C3%A9bastien-galli%C3%A9",
    },
    bioShort: "Senior accountant managing bookkeeping, reporting and monthly closes for clients; focused on reliable numbers and clear deliverables.",
  },
  {
    name: "Maulk Hamdi",
    role: "Associate",
    profilePic: "/assets/missing-profile.svg",
    social: {
      linkedin: "https://www.linkedin.com/in/maulk-hamdi-b47b68361",
    },
    bioShort: "In charge of admin and accounting; law student supporting day‑to‑day client operations.",
  },
];

export const isPartnerRole = (role: TeamMember["role"]) => role === "Partner" || role === "ManagingPartner";

// Helpers for routing/profile pages
export const slugify = (s: string) =>
  s
    .normalize("NFD")
    // strip combining diacritical marks
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const getMemberSlug = (m: TeamMember) => slugify(m.name);
export const findMemberBySlug = (slug: string): TeamMember | undefined =>
  teamMembers.find((m) => getMemberSlug(m) === slug);
