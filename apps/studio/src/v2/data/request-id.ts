// A help request's own id (open_case's `p_id`). The database answers the case stored the first time when an id comes
// again (`reused`), whatever the words, so an id may be sent again only with exactly what it was first sent with: a
// retry of the same words after a lost answer is the same request, never a second one, and the owner's edited words
// always go as a new request (with a new id), so Halom never misses them. Pure: the id maker is passed in for tests.
import { newUuid } from '@mana/contracts';

/** What a request says. `allowAct` is for a form that carries the owner's switch with the request (absent here). */
export type RequestContent = { readonly topic: string; readonly subject: string; readonly body: string; readonly allowAct?: boolean | null };

export type RequestIds = {
  /** The id to send this content with: the last try's when nothing changed since it, else a new one. */
  forContent(c: RequestContent): string;
  /** The request was stored: the next one gets a new id. */
  sent(): void;
};

export function requestIds(make: () => string = newUuid): RequestIds {
  let id = make(), sentWith: string | null = null;
  return {
    forContent(c) {
      const key = JSON.stringify([c.topic, c.subject, c.body, c.allowAct ?? null]);
      if (sentWith !== null && key !== sentWith) id = make();
      sentWith = key;
      return id;
    },
    sent() { id = make(); sentWith = null; },
  };
}
