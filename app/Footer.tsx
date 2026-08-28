import Link from "next/link";
import { SUPPORTER_KOFI_URL } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span>© {new Date().getFullYear()} Selfdestruct</span>
        <nav className="site-footer-nav">
          <Link href="/info">FAQ &amp; details</Link>
          <Link href="/batch">Send to several people</Link>
          <a href="https://github.com/olearydc/selfdestruct">Source code</a>
          <a href={SUPPORTER_KOFI_URL}>Support this project</a>
          <a href="mailto:info@selfdestruct.online">Contact</a>
        </nav>
      </div>
    </footer>
  );
}
