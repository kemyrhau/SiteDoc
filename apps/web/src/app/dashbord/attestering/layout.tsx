// w10b (S3): attesteringen står utenfor firma-layouten, som har firma-admin-gaten. Tilgangen
// avgjøres på siden av `kanAttestereFirma` (firma-admin: alle; prosjektleder: sine prosjekter).
export default function AttesteringLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex-1 overflow-auto bg-gray-50 p-6">{children}</main>;
}
