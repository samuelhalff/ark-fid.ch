// Static imports for team portraits to enable automatic blur placeholders
// Map the known profilePic paths used in src/lib/team.ts to imported images

import hb from "@/public/assets/team/hb.webp";
import sh from "@/public/assets/team/sh.webp";
import rs from "@/public/assets/team/rs.webp";
import ld from "@/public/assets/team/ld.webp";
import at from "@/public/assets/team/at.webp";
import cl from "@/public/assets/team/cl.webp";

export const teamImageMap: Record<string, any> = {
  "/assets/team/hb.webp": hb,
  "/assets/team/sh.webp": sh,
  "/assets/team/rs.webp": rs,
  "/assets/team/ld.webp": ld,
  "/assets/team/at.webp": at,
  "/assets/team/cl.webp": cl,
};
