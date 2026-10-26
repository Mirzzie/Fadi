import { PublicAppearance } from "../../components/portfolio/public-appearance";

export default function PublicPortfolioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PublicAppearance />
    </>
  );
}
