# Nayan Bhut — personal site

Live at **https://nayanbhut.github.io**

A Jekyll site for GitHub Pages. No build pipeline beyond Jekyll; no JavaScript
dependencies.

## Structure

```
.
├── _config.yml                 site title, description, author, defaults
├── _includes/                  head (SEO, JSON-LD), header, footer, icons
├── _layouts/                   default, page, work (case study), contribution, post
├── _posts/                     blog posts (Markdown)
├── assets/
│   ├── css/style.css           all styling, light + dark tokens
│   ├── img/                    OG image, favicons, app icons
│   └── js/site.js              theme, mobile menu, reveal, scroll spy, copy email
├── work/                       three case studies
├── open-source/                four contribution write-ups
├── blog/index.html             post index
├── index.html                  home page (hero, about, experience, projects, OSS, contact)
├── 404.html
├── resume.pdf                  linked as /resume.pdf?v=YYYY-MM-DD
├── robots.txt
├── sitemap.xml
└── site.webmanifest
```

## Preview locally

```sh
gem install jekyll
jekyll serve
# http://127.0.0.1:4000
```

Alternatively `bundle exec jekyll serve` if you add a Gemfile later.

## Editing content

- **Personal details, nav, hero:** `index.html`
- **SEO defaults and social links:** `_config.yml`, `_includes/head.html`
- **Experience and dates:** `index.html` → `#experience`
- **Case studies:** `work/*.html`
- **Open-source write-ups:** `open-source/*.html`
- **Blog:** add a Markdown file to `_posts/` named `YYYY-MM-DD-slug.md` with
  `title` and `description` front matter.
- **Résumé:** replace `resume.pdf`, then bump the version query. It appears in
  `_includes/header.html`, `index.html` and `_includes/footer.html`.

```sh
grep -rl "resume.pdf?v=" . --include="*.html"
```

## Publishing changes

The repository is already wired up:

- Repo: https://github.com/NayanBhut/NayanBhut.github.io (public)
- Pages source: **Deploy from a branch** → `main` / `/ (root)`
- Live: https://nayanbhut.github.io

To publish an edit:

```sh
git add -A
git commit -m "Update experience section"
git push
```

GitHub Pages rebuilds in about 40 seconds. Check the build with:

```sh
gh api repos/NayanBhut/NayanBhut.github.io/pages/builds/latest --jq .status
```

GitHub Pages builds Jekyll automatically. There is no Actions workflow to
maintain. Do **not** add `.nojekyll`, or Liquid layouts stop rendering.

## Facts policy

Every title, date, employer, metric and store link on the site comes from the
supplied résumé and the public GitHub account. If a fact changes, update it in
one place and check the matching case study.
