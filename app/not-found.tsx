import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty-state">
      <p className="eyebrow">Not found</p>
      <h1>That instrument or section is not available.</h1>
      <p>
        The generated corpus only contains the three aged care instruments currently committed in the
        repository.
      </p>
      <Link className="button button--primary" href="/">
        Return to the corpus
      </Link>
    </div>
  );
}
