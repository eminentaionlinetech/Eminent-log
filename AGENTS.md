<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Shared site branding uses the uploaded logo and cropped header symbol from root-relative `/assets/` paths backed by `public/assets`, with a local public favicon, so branding works on independent deployments without Lovable asset routing.
- Lesson video/PDF access goes through `getLessonPlayback` (short-lived signed URLs after enrolment + access checks); the storage bucket stays private so files can't be hot-linked.
- Lesson progress is written only via the `record_lesson_progress` SQL function, which re-checks enrolment and access and sets course completion, so clients can't forge progress.
- Premium is granted only by `grant_premium_payment` (service-role only), called after re-verifying the charge with Korapay's API, never from webhook payload data alone.
