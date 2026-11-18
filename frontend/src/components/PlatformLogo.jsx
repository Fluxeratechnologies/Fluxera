import anthropic from "simple-icons/icons/anthropic.svg";
import github from "simple-icons/icons/github.svg";
import postgresql from "simple-icons/icons/postgresql.svg";
import vercel from "simple-icons/icons/vercel.svg";
import zapier from "simple-icons/icons/zapier.svg";

const platforms = { Anthropic: anthropic, GitHub: github, PostgreSQL: postgresql, Vercel: vercel, Zapier: zapier };
export function PlatformLogo({ name }) { const src = platforms[name]; return src ? <img className="platform-logo" src={src} alt={`${name} logo`} loading="lazy"/> : null; }
