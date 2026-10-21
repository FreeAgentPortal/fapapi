# Post link previews

`PostHandler.beforeCreate` generates a preview for the first recognized web link
in the sanitized post body, only when the post has no attached media. It awaits
the result before saving the post. There is no preview queue and no enrichment
during feed reads.

The existing `Post.links` array stores at most one generated preview:

```json
{
  "links": [{
    "url": "https://example.com/article",
    "canonicalUrl": "https://example.com/article",
    "title": "Article title",
    "description": "Article description",
    "siteName": "Example",
    "imageUrl": "https://example.com/thumbnail.jpg"
  }]
}
```

Only `url` is required. `canonicalUrl` is the final fetched page URL after
redirects. Open Graph metadata takes precedence over Twitter card metadata,
then the HTML title/description. Image URLs are resolved relative to the final
page URL and checked for public destinations. Image bytes are not copied to
storage: the frontend loads the stored URL lazily and hides failed images.

The entire attempt has a five-second deadline, at most three redirects, a 1 MiB
HTML limit, and no retries. HTTP(S) on default ports is supported. Every page
request resolves and validates all DNS addresses, then pins the connection to
a validated public IP. Private/reserved addresses, credentials, non-HTML and
unexpected compressed responses are rejected. Scripts are never executed.

Failures produce an empty `links` array and do not prevent post creation.
Client-provided preview metadata is replaced during creation and ignored on
updates. Body/media edits clear stored previews without fetching again.
Existing posts are not backfilled. The frontend uses its URL-only card whenever
matching saved metadata is unavailable, and never displays a preview alongside
attached media. Feed list/detail inflation already includes `links` in
`objectDetails`; no API response or database migration is required.
