---
layout: post
title: "Reviewing a 237k-character PR diff without truncation"
description: "A 200k cut-off made an automated review look complete while skipping the last 37,000 characters. Here is the chunking strategy that fixed it — and the failure modes it had to survive."
date: 2026-09-22 12:00:00 +0530
---
<p>
  An automated review that silently skips part of a diff is worse than no review at all. The
  output looks finished. Nothing in the comment says "I stopped reading at 200,000 characters."
  The author merges, reasonably believing someone — or something — looked at the change.
</p>

<p>
  That is what happened in my macOS app's CI. The review step capped the diff at 200k characters.
  On a 237k-character pull request, the last ~37,000 characters were never sent: a view model, a
  sidebar view and the tests. The review still returned a tidy list of findings.
</p>

<h2>Why truncation is the wrong failure mode</h2>

<p>
  A size limit is a reasonable guard against runaway cost. The mistake is where the failure is
  reported. Truncating in the workflow, before the reviewer runs, hides the loss from every layer
  that could have said something about it.
</p>

<p>
  The rule I took from this: if the system cannot review everything, it must either say so or fail.
  Silence is not an acceptable outcome.
</p>

<h2>Chunk on files, not characters</h2>

<p>
  Splitting a diff at an arbitrary character offset breaks its grammar. A file header can land at
  the end of one chunk, its first hunk at the start of the next, and the model sees fragments with
  no context. It is also impossible to tell which findings belong to which file.
</p>

<p>
  The replacement splits at <code>diff --git</code> boundaries: each chunk contains whole files,
  up to about 150k characters. One oversized file becomes a chunk by itself rather than being cut
  in half. The aim is not perfectly equal chunks; it is never reviewing half a file.
</p>

<pre><code>filter noise (docs, Markdown, Xcode project files)
        ↓
split on diff --git boundaries
        ↓
chunk ≤ 150k, whole files only
        ↓
review chunk 1 → findings
review chunk 2 with chunk 1 findings as context
        ↓
combine under "Review part N/M (files: …)"</code></pre>

<p>
  Passing earlier findings forward matters. Without it, the model re-reports the same issue in
  every chunk, and the comment becomes noise. With it, the instruction is explicit: add only new
  findings.
</p>

<h2>Make the plan inspectable</h2>

<p>
  The most useful addition was not the chunker; it was <code>--dry-run</code>. It prints the chunk
  plan — count, sizes, file lists — with no API key and no API call. That turns a costly experiment
  into a local check, and it makes CI behaviour debuggable without reading the source.
</p>

<p>
  The PR exercised the pipeline on itself. Its raw diff was 237,777 characters. A dry run split it
  into two chunks of 90,324 and 105,130 characters across 13 and 4 files, with 41,787 characters of
  generated or documentation noise filtered out. All 22 source files were accounted for.
</p>

<h2>Failure modes worth designing for</h2>

<ul>
  <li>
    <strong>A chunk fails after earlier ones succeed.</strong> Fail the run, but still print the
    findings that were produced. Partial information beats a blank comment.
  </li>
  <li>
    <strong>The diff contains only docs.</strong> Print "No reviewable source changes" and exit 0.
    This is not an error.
  </li>
  <li>
    <strong>Filtering or chunking loses a file.</strong> Abort loudly. A missing
    <code>diff --git</code> header is a bug in the tool, not something to work around.
  </li>
  <li>
    <strong>The contract changes.</strong> Keep the same environment variables, output file, exit
    codes and error prefixes. A fix to an internal step should not become a migration for everyone
    who calls it.
  </li>
</ul>

<h2>The uncomfortable trade-off</h2>

<p>
  Reviewing a large PR now costs more: more API calls, more latency, more tokens. There is no way
  around that if the goal is full coverage. The alternative is cheaper and less honest.
</p>

<p>
  The test suite for the change is about 325 lines, which is more than the chunker itself. That is
  the right ratio for infrastructure: the part that decides what gets reviewed should be easier to
  trust than the review.
</p>

<div class="callout">
  <p>
    The pull request is
    <a href="https://github.com/NayanBhut/TestFlightReleaseNotes/pull/22" target="_blank" rel="noopener">#22 on GitHub</a>,
    and the shorter engineering summary is in the
    <a href="{{ '/open-source/pr-review-chunking/' | relative_url }}">open-source write-up</a>.
  </p>
</div>
