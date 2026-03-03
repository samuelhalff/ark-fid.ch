// Static imports for team portraits to enable automatic blur placeholders
// Map the known profilePic paths used in src/lib/team.ts to imported images

import hb from "@/public/assets/team/hb.avif";
import sh from "@/public/assets/team/sh.avif";
import rs from "@/public/assets/team/rs.avif";
import ld from "@/public/assets/team/ld.avif";
import at from "@/public/assets/team/at.avif";
import cl from "@/public/assets/team/cl.avif";
import sg from "@/public/assets/team/sg.avif";
import mh from "@/public/assets/team/mh.avif";

export const teamImageMap: Record<string, any> = {
  "/assets/team/hb.avif": hb,
  "/assets/team/sh.avif": sh,
  "/assets/team/rs.avif": rs,
  "/assets/team/ld.avif": ld,
  "/assets/team/at.avif": at,
  "/assets/team/cl.avif": cl,
  "/assets/team/sg.avif": sg,
  "/assets/team/mh.avif": mh,
};
