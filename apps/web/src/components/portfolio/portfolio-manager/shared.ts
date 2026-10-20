import type { PortfolioItemView } from "@careeros/portfolio";

// Section vocabulary + the editable-item form shape, shared by the manager and its editors.

export const SECTION_KEYS = [
  "project",
  "experience",
  "education",
  "certification",
  "skill",
  "hobby",
  "custom",
] as const;

export const SECTION_META: Record<string, { label: string; description: string }> = {
  project: { label: "Projects", description: "Case studies & featured work" },
  experience: { label: "Experience", description: "Jobs, internships, consulting" },
  education: { label: "Education", description: "Degrees & schooling" },
  certification: { label: "Certifications", description: "AWS, security, courses" },
  skill: { label: "Skills", description: "Tools, tech, and disciplines" },
  hobby: { label: "Hobbies & Interests", description: "Personal interests" },
  custom: { label: "Custom Section", description: "Anything else — awards, talks, etc." },
};

export const ROLES = [
  { value: "support", label: "IT Support" },
  { value: "cloud", label: "Cloud" },
  { value: "security", label: "Security" },
];

export const RESUME_KEYS = [
  { key: "default", label: "Default" },
  { key: "support", label: "IT Support" },
  { key: "cloud", label: "Cloud" },
  { key: "security", label: "Security" },
];

export type ItemForm = {
  id?: string;
  section: string;
  title: string;
  subtitle: string;
  location: string;
  dateRange: string;
  tag: string;
  url: string;
  description: string;
  bulletsText: string;
  imageUrl: string;
  galleryText: string;
  roles: string[];
};

export function emptyForm(section = "project"): ItemForm {
  return {
    section,
    title: "",
    subtitle: "",
    location: "",
    dateRange: "",
    tag: "",
    url: "",
    description: "",
    bulletsText: "",
    imageUrl: "",
    galleryText: "",
    roles: [],
  };
}

export function toForm(item: PortfolioItemView): ItemForm {
  return {
    id: item.id,
    section: item.section,
    title: item.title,
    subtitle: item.subtitle ?? "",
    location: item.location ?? "",
    dateRange: item.dateRange ?? "",
    tag: item.tag ?? "",
    url: item.url ?? "",
    description: item.description ?? "",
    bulletsText: (item.bullets ?? []).join("\n"),
    imageUrl: item.imageUrl ?? "",
    galleryText: (item.gallery ?? []).join("\n"),
    roles: item.roles ?? [],
  };
}
