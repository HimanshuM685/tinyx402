import { DocsSidebar } from "./sidebar";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-7xl gap-10 px-4 sm:px-6">
      <DocsSidebar />
      <main className="prose-doc min-w-0 flex-1 py-10">{children}</main>
    </div>
  );
}
