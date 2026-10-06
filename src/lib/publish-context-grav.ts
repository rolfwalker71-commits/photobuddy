import {
  getGravPage,
  getGravTripData,
  gravConfig,
  listGravContextPosts,
} from "@/lib/grav";
import { loadPublishContext, type PublishContext } from "@/lib/publish-context";

/** Best-effort site context; never throws. Empty parts when Grav is not set up or fails. */
export async function gravPublishContext(autor: string, date: string): Promise<PublishContext> {
  try {
    return await loadPublishContext(autor, date, {
      configured: () => gravConfig() !== null,
      tripData: getGravTripData,
      posts: listGravContextPosts,
      page: (route) => getGravPage(route),
    });
  } catch {
    return { trip: null, samples: [], previous: null };
  }
}
