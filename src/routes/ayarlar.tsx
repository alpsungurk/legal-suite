import { createFileRoute } from "@tanstack/react-router";
import { Settings, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ManagementPage } from "@/components/management/ManagementPage";
import { buildUserFormFields } from "@/lib/management-form-config";
import { useErp } from "@/lib/erp-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UserRole } from "@/lib/erp-types";

export const Route = createFileRoute("/ayarlar")({ component: Page });

function CategoryManager({
  title,
  items,
  canManage,
  onAdd,
  onRemove,
}: {
  title: string;
  items: string[];
  canManage: boolean;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <Card className="border-border/80 shadow-soft">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {canManage && (
          <div className="flex gap-2">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Yeni tür adı"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!value.trim()) return;
                  onAdd(value.trim());
                  setValue("");
                  toast.success("Tür eklendi");
                }
              }}
            />
            <Button
              onClick={() => {
                if (!value.trim()) return;
                onAdd(value.trim());
                setValue("");
                toast.success("Tür eklendi");
              }}
            >
              <Plus className="h-4 w-4" /> Ekle
            </Button>
          </div>
        )}
        <ul className="divide-y rounded-lg border">
          {items.map((item) => (
            <li key={item} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>{item}</span>
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => {
                    onRemove(item);
                    toast.success("Tür silindi");
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
          {!items.length && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">Henüz tür yok</li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

function Page() {
  const {
    state,
    currentUser,
    permissions,
    upsertUser,
    deleteUser,
    addCategory,
    removeCategory,
    setCurrentUserId,
  } = useErp();

  if (!permissions.canAccessSettings) {
    return (
      <div className="rounded-xl border p-8 text-center text-muted-foreground">
        Bu sayfaya erişim yetkiniz yok.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">Ayarlar ve Yetkiler</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Kullanıcıları, rolleri ve dosya / masraf / hatırlatma kategorilerini yönetin.
        </p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Kullanıcılar</TabsTrigger>
          <TabsTrigger value="categories">Kategoriler</TabsTrigger>
          <TabsTrigger value="session">Oturum</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <ManagementPage
            title="Kullanıcılar"
            description="Büro kullanıcılarını ekleyin ve rol atayın."
            singular="kullanıcı"
            icon={Settings}
            accent="blue"
            canCreate={permissions.canManageUsers}
            canEdit={permissions.canManageUsers}
            canDelete={permissions.canManageUsers}
            columns={[
              { key: "name", label: "Ad Soyad" },
              { key: "username", label: "Kullanıcı adı" },
              { key: "email", label: "E-posta" },
              {
                key: "role",
                label: "Rol",
                filterable: true,
                filterOptions: ["Admin", "Avukat", "Sekreter"],
              },
            ]}
            formFields={buildUserFormFields()}
            stats={[
              { label: "Aktif kullanıcı", value: String(state.users.length), note: "Kayıtlı" },
              {
                label: "Yönetici",
                value: String(state.users.filter((u) => u.role === "Admin").length),
                note: "Tam yetki",
              },
              { label: "Siz", value: currentUser.role, note: currentUser.name },
            ]}
            emptyCreateValues={{ role: "Avukat" }}
            rows={state.users.map((u) => ({
              id: u.id,
              name: u.name,
              username: u.username,
              email: u.email,
              role: u.role,
            }))}
            getEditValues={(row) => {
              const u = state.users.find((x) => x.id === row.id);
              return {
                name: u?.name ?? "",
                username: u?.username ?? "",
                email: u?.email ?? "",
                role: u?.role ?? "Avukat",
              };
            }}
            onSave={(data, editingId) => {
              upsertUser({
                id: editingId ?? undefined,
                name: data.name,
                username: data.username,
                email: data.email,
                role: (data.role as UserRole) || "Avukat",
              });
              toast.success(editingId ? "Kullanıcı güncellendi" : "Yeni kullanıcı eklendi");
            }}
            onDelete={(id) => {
              if (id === currentUser.id) {
                toast.error("Aktif oturum kullanıcısı silinemez");
                return;
              }
              deleteUser(id);
              toast.success("Kullanıcı silindi");
            }}
          />
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <CategoryManager
              title="Dosya türleri"
              items={state.caseTypes}
              canManage={permissions.canManageCategories}
              onAdd={(name) => addCategory("caseTypes", name)}
              onRemove={(name) => removeCategory("caseTypes", name)}
            />
            <CategoryManager
              title="Masraf türleri"
              items={state.expenseTypes}
              canManage={permissions.canManageCategories}
              onAdd={(name) => addCategory("expenseTypes", name)}
              onRemove={(name) => removeCategory("expenseTypes", name)}
            />
            <CategoryManager
              title="Hatırlatma türleri"
              items={state.reminderTypes}
              canManage={permissions.canManageCategories}
              onAdd={(name) => addCategory("reminderTypes", name)}
              onRemove={(name) => removeCategory("reminderTypes", name)}
            />
          </div>
          {!permissions.canManageCategories && (
            <p className="mt-3 text-sm text-muted-foreground">
              Kategori düzenleme yetkiniz yok (yalnızca görüntüleme).
            </p>
          )}
        </TabsContent>

        <TabsContent value="session" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aktif kullanıcı değiştir (demo)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {state.users.map((u) => (
                <Button
                  key={u.id}
                  variant={u.id === currentUser.id ? "default" : "outline"}
                  onClick={() => {
                    setCurrentUserId(u.id);
                    toast.success(`${u.name} olarak devam ediyorsunuz`);
                  }}
                >
                  {u.name} ({u.role})
                </Button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
