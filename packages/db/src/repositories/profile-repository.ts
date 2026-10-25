import type { ParsedResume, ProfileRepository, ProfileView } from "@ajh/core";
import { asc, eq, sql } from "drizzle-orm";
import type { Executor } from "../client";
import {
  profileCertifications,
  profileEducations,
  profileExperiences,
  profiles,
  profileSkills,
} from "../schema";

export class DrizzleProfileRepository implements ProfileRepository {
  constructor(private readonly db: Executor) {}

  replaceFromResume(userId: string, parsed: ParsedResume): Promise<void> {
    return this.db.transaction(async (tx) => {
      await tx
        .insert(profiles)
        .values({
          userId,
          headline: parsed.headline,
          summary: parsed.summary,
          location: parsed.location,
          links: parsed.links,
        })
        .onConflictDoUpdate({
          target: profiles.userId,
          set: {
            headline: parsed.headline,
            summary: parsed.summary,
            location: parsed.location,
            links: parsed.links,
            updatedAt: sql`now()`,
          },
        });

      await tx.delete(profileExperiences).where(eq(profileExperiences.userId, userId));
      await tx.delete(profileEducations).where(eq(profileEducations.userId, userId));
      await tx.delete(profileSkills).where(eq(profileSkills.userId, userId));
      await tx.delete(profileCertifications).where(eq(profileCertifications.userId, userId));

      if (parsed.experiences.length) {
        await tx.insert(profileExperiences).values(
          parsed.experiences.map((e, i) => ({
            id: e.id,
            userId,
            company: e.company,
            title: e.title,
            location: e.location,
            startDate: e.startDate,
            endDate: e.endDate,
            isCurrent: e.isCurrent,
            bullets: e.bullets,
            sortOrder: i,
          })),
        );
      }
      if (parsed.education.length) {
        await tx.insert(profileEducations).values(parsed.education.map((e, i) => ({ ...e, userId, sortOrder: i })));
      }
      if (parsed.skills.length) {
        await tx.insert(profileSkills).values(parsed.skills.map((name) => ({ userId, name })));
      }
      if (parsed.certifications.length) {
        await tx
          .insert(profileCertifications)
          .values(parsed.certifications.map((c, i) => ({ ...c, userId, sortOrder: i })));
      }
    });
  }

  async getView(userId: string): Promise<Omit<ProfileView, "masterResume" | "fullName"> | null> {
    const [profile] = await this.db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
    if (!profile) return null;

    const [experiences, education, skills, certifications] = await Promise.all([
      this.db
        .select()
        .from(profileExperiences)
        .where(eq(profileExperiences.userId, userId))
        .orderBy(asc(profileExperiences.sortOrder)),
      this.db
        .select()
        .from(profileEducations)
        .where(eq(profileEducations.userId, userId))
        .orderBy(asc(profileEducations.sortOrder)),
      this.db.select({ name: profileSkills.name }).from(profileSkills).where(eq(profileSkills.userId, userId)),
      this.db
        .select()
        .from(profileCertifications)
        .where(eq(profileCertifications.userId, userId))
        .orderBy(asc(profileCertifications.sortOrder)),
    ]);

    return {
      userId,
      headline: profile.headline,
      summary: profile.summary,
      location: profile.location,
      links: profile.links,
      experiences: experiences.map((e) => ({
        id: e.id,
        company: e.company,
        title: e.title,
        location: e.location,
        startDate: e.startDate,
        endDate: e.endDate,
        isCurrent: e.isCurrent,
        bullets: e.bullets,
      })),
      education: education.map(({ school, degree, field, startDate, endDate }) => ({
        school,
        degree,
        field,
        startDate,
        endDate,
      })),
      certifications: certifications.map(({ name, issuer, date }) => ({ name, issuer, date })),
      skills: skills.map((s) => s.name),
    };
  }
}
