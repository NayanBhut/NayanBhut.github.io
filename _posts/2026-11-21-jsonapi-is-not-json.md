---
layout: post
title: "JSON:API is not JSON: resolving relationships you cannot see"
description: "A JSON:API document is a flat list of resources plus type/id pointers. Expanding one level of included looks correct and often isn't — here is what recursive resolution has to survive, and what it found in a real production response."
date: 2026-11-21 12:00:00 +0530
---
<p>
  A JSON:API document parses as JSON, which is the root of most of the confusion. The shape is
  familiar — objects, arrays, strings — so people read it with a JSON mindset and conclude that a
  relationship pointing at <code>{ "type": "widgets", "id": "25676" }</code> is somehow "resolved".
  It is not. That object is a pointer into a different part of the document, and if the resource
  it names is not there, the pointer is a dead end that still renders perfectly.
</p>

<p>
  I built <a href="https://nayanbhut.github.io/jsonapi-lens/" target="_blank" rel="noopener">JSON:API
  Lens</a> because I kept hitting this while debugging a storefront API. The document looked fine,
  the viewer showed a tidy tree, and the thing I actually needed — what is nested under this screen —
  was two includes away and silently absent.
</p>

<h2>The flat shape is the point</h2>

<p>
  JSON:API splits a response into <code>data</code> (primary resources) and <code>included</code> (a
  flat list of every other resource the server decided to send). Relationships between them are
  resource linkage: a type/id pair, or an array of them, or null. Nothing is nested. A request like
  <code>include=widgets.blocks.actions</code> asks the server to append those resources to
  <code>included</code> — it does not ask it to build a tree.
</p>

<p>
  That design is good. It avoids duplication, makes caching per resource possible, and keeps payloads
  predictable. It also means the tree you want exists only as an interpretation of pointers, and
  every tool that renders JSON:API has to make that interpretation explicitly — or quietly skip it.
</p>

<h2>One level of expansion looks like it worked</h2>

<p>
  The easy implementation maps each relationship to a chip with the target's type and id, then lists
  <code>included</code> separately as "39 resources". Nothing is wrong on screen. But the question a
  developer opens the tool to answer is "what is under this thing", and that question is never
  answered at depth one. At depth one, every relationship on an included resource is still just a
  chip.
</p>

<p>
  Going deeper is a graph walk, and a graph walk over user-supplied data has two failure modes that
  are easy to get wrong.
</p>

<h2>Failure one: identity</h2>

<p>
  A resource's identity is <code>type</code> plus <code>id</code> — not <code>id</code> alone.
  <code>widgets:25676</code> and <code>blocks:25676</code> are different resources, and a map keyed
  by id alone will happily return the wrong one. Client-generated resources use
  <code>lid</code> instead of <code>id</code>, so identity has to fall through to
  <code>type:lid:…</code> rather than producing <code>widgets:undefined</code> for every one of them.
</p>

<h2>Failure two: cycles, and why "visited" is the wrong guard</h2>

<p>
  Real graphs contain cycles: a block points at an action that points back at the block. Recursion
  without a guard never returns. The reflex is a global <code>visited</code> set, and it is wrong in
  a subtler way than the crash: a resource reachable through two different paths is not a cycle, but
  a global visited set will refuse to render it the second time and the tree will silently lose a
  branch.
</p>

<p>
  The guard has to be per path, not per document. Each recursion carries the set of ancestors on the
  current path; a target already in that set is a cycle, and a target in the document but not on the
  path expands normally.
</p>

<pre><code>resolve(resource, ancestors):
    next = ancestors + resource.key

    for each relationship pointer:
        target = document.get(type + ":" + id)
        if target is null:          → missing (sparse linkage)
        if target.key in next:      → cycle (stop here, say so)
        else:                       → resolve(target, next)</code></pre>

<p>
  The distinction matters on screen, because the two outcomes mean different things. A cycle is
  correct data that must not be expanded further. A missing target is data that was not sent. Both
  get an explicit card with the linkage pointer that led there — the anchor back to the raw document,
  so the reader can check the claim instead of trusting the tree.
</p>

<h2>Missing linkage is normal, not broken</h2>

<p>
  In the production response I verified against, 19 unique targets could not be resolved. None of
  them was a server bug: they were <code>stores</code> and <code>screen-revisions</code> resources
  that the request never asked for in <code>include</code>. The spec calls this sparse linkage, and
  it is the common case. A viewer that hides unresolved pointers is not simplifying — it is
  removing the evidence that something was not requested.
</p>

<p>
  The related check is full linkage: every resource in <code>included</code> must be reachable from
  primary data. An included resource nothing points at is a violation, and my verified response had
  zero of them. It is the kind of thing that is invisible in a flat list and obvious once you build
  the graph: orphans are rendered in their own section with an <code>unlinked</code> badge.
</p>

<h2>Projection: turning the envelope into plain JSON</h2>

<p>
  Once the graph resolves, projecting a resource into ordinary nested JSON is the useful payoff —
  attributes flattened onto the resource, relationship names holding resolved objects instead of
  pointers. Three rules keep it honest, because a projection that loses information is worse than no
  projection:
</p>

<ul>
  <li>
    <strong>Unresolved pointers stay visible.</strong> They become
    <code>{ "type": "stores", "id": "9", "_missing": true }</code>, not <code>null</code>.
  </li>
  <li>
    <strong>Cycles stop with a marker.</strong> <code>_cycle: true</code>, so a consumer can tell a
    repeat from an empty relationship.
  </li>
  <li>
    <strong>Name collisions are preserved.</strong> If a relationship shares a name with an
    attribute, the relationship moves under <code>_relationships</code> instead of overwriting the
    attribute.
  </li>
</ul>

<p>
  There is a budget as well — 5,000 resources, then <code>_truncated: true</code>. Without it, copying
  a resource from a 100,000-resource document is a good way to hang the tab.
</p>

<h2>Scale is a rendering problem, not a parsing problem</h2>

<p>
  The parser and model builder are linear; the DOM is what breaks. Measured in headless Chrome on a
  local server:
</p>

<pre><code>10,000 resources    2.4 MB     ~0.5 s
100,000 resources   24.4 MB    ~3.4 s     ~190 MB heap
200,000 resources   49.3 MB    ~13 s      ~340 MB heap
400,000 resources   99 MB      —          refused before parsing</code></pre>

<p>
  So the guards are all in the rendering layer: a 50 MB input cap with a notice instead of a frozen
  tab, primary cards in pages of 200, validation issues paged by severity with "copy all", the JSON
  tab dropping to plain text above 1.2 MB, and a graph capped at 400 nodes with the extra edges
  summarized in the toolbar. Up to about 10 MB the tool feels instant; around 25 MB it is comfortable;
  50 MB is usable and slow, which is the honest description.
</p>

<h2>What it found in a real response</h2>

<p>
  I verified the whole pipeline against a production storefront API — a legacy endpoint returning
  <code>application/vnd.api+json</code>:
</p>

<ul>
  <li>28,788 bytes, HTTP 200, <strong>0 spec violations</strong> against JSON:API 1.1.</li>
  <li>1 primary <code>screens</code> resource, 39 included resources, 59 linkages, 4 types.</li>
  <li>
    A four-level chain resolved correctly:
    <code>screens #1685 → widgets #25676 → blocks #92683 → actions #93027</code>.
  </li>
  <li>All 31 <code>actions</code> resolved under their blocks; 19 sparse targets reported as missing.</li>
  <li>Graph: 40 resolved nodes, 39 edges, 0 orphans.</li>
</ul>

<p>
  That last line is the one I care about. A flat list of 39 resources tells you nothing about
  whether the data is shaped correctly; the graph makes an unlinked resource and an unrequested one
  two different, visible findings.
</p>

<h2>No dependencies, deliberately</h2>

<p>
  The whole tool is about 4,700 lines of dependency-free JavaScript — parser, model, tree, graph,
  UI — with 33 core tests and 5 tree tests. A debugging instrument that needs a build step and a
  package tree is harder to trust than the thing it is debugging, and harder to keep running two
  years later. Static files, no runtime dependencies, and the validator follows the spec's own
  pointers so a failed check links to the exact member it is complaining about.
</p>

<div class="callout">
  <p>
    Try it on your own payload:
    <a href="https://nayanbhut.github.io/jsonapi-lens/viewer/" target="_blank" rel="noopener">the viewer</a>,
    or read the shorter guides on
    <a href="https://nayanbhut.github.io/jsonapi-lens/docs/jsonapi-relationships/" target="_blank" rel="noopener">relationships and included resources</a>
    and the
    <a href="https://nayanbhut.github.io/jsonapi-lens/docs/jsonapi-validator/" target="_blank" rel="noopener">JSON:API 1.1 validator</a>.
    The source is
    <a href="https://github.com/NayanBhut/jsonapi-lens" target="_blank" rel="noopener">on GitHub</a>.
  </p>
</div>
