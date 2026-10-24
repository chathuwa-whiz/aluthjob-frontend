import type { Profile } from "../api/types";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = /\.(pdf|docx?)$/i;

/** Returns a message when the file cannot be used, so the person is told before a slow upload begins. */
export function checkResumeFile(file: File): string | null {
  if (!ACCEPTED.test(file.name)) return "Please choose a PDF or Word document (.pdf, .doc or .docx).";
  if (file.size > MAX_BYTES) return "That file is larger than 5 MB. Export a smaller PDF and try again.";
  if (file.size === 0) return "That file is empty.";
  return null;
}

export const clean = (value: string) => value.trim();
const orNull = (value: string | null) => (value && value.trim() ? value.trim() : null);

/** What goes to the server: trimmed, empty boxes as null, blank list entries dropped. */
export function normalizeProfile(profile: Profile): Profile {
  return {
    personalInfo: {
      fullName: orNull(profile.personalInfo.fullName),
      email: orNull(profile.personalInfo.email),
      phone: orNull(profile.personalInfo.phone),
      location: orNull(profile.personalInfo.location),
      linkedin: orNull(profile.personalInfo.linkedin),
      portfolio: orNull(profile.personalInfo.portfolio),
    },
    skills: [...new Set(profile.skills.map(clean).filter(Boolean))],
    education: profile.education
      .map((item) => ({ institution: orNull(item.institution), degree: orNull(item.degree), field: orNull(item.field), startDate: orNull(item.startDate), endDate: orNull(item.endDate) }))
      .filter((item) => Object.values(item).some(Boolean)),
    experience: profile.experience
      .map((item) => ({
        company: orNull(item.company),
        position: orNull(item.position),
        startDate: orNull(item.startDate),
        endDate: orNull(item.endDate),
        responsibilities: item.responsibilities.map(clean).filter(Boolean),
      }))
      .filter((item) => item.company || item.position || item.responsibilities.length > 0),
    certifications: profile.certifications.map(clean).filter(Boolean),
    achievements: profile.achievements.map((item) => ({ description: clean(item.description) })).filter((item) => item.description),
  };
}
