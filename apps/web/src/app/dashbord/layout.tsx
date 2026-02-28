import { Toppmeny } from "@/components/Toppmeny";

export default function DashbordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Toppmeny />
      <main className="p-6">{children}</main>
    </div>
  );
}
