"use client"

import { useState } from "react"
import { useOrganization, useUser } from "@clerk/nextjs"
import { UserPlus, Crown, User, Trash2, Mail, Loader2, Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

export function EquipeTab() {
  const { user } = useUser()
  const { organization, memberships, invitations, isLoaded } = useOrganization({
    memberships: { infinite: false },
    invitations: { infinite: false },
  })

  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"org:admin" | "org:member">("org:member")
  const [inviting, setInviting] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const handleInvite = async () => {
    if (!email.trim() || !organization) return
    setInviting(true)
    try {
      await organization.inviteMember({ emailAddress: email.trim(), role })
      toast.success(`Invitation envoyée à ${email.trim()}`)
      setEmail("")
      invitations?.revalidate?.()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'invitation")
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async (membershipId: string) => {
    setRemovingId(membershipId)
    try {
      const m = memberships?.data?.find((x) => x.id === membershipId)
      await m?.destroy()
      toast.success("Membre retiré")
      memberships?.revalidate?.()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur")
    } finally {
      setRemovingId(null)
    }
  }

  const handleRevoke = async (invitationId: string) => {
    setRevokingId(invitationId)
    try {
      const inv = invitations?.data?.find((x) => x.id === invitationId)
      await inv?.revoke()
      toast.success("Invitation annulée")
      invitations?.revalidate?.()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur")
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Invite form */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Inviter un membre
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="invite-email">Adresse courriel</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="collegue@clinique.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rôle</Label>
              <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="org:admin">Admin</SelectItem>
                  <SelectItem value="org:member">Membre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="invisible">Envoyer</Label>
              <Button onClick={handleInvite} disabled={inviting || !email.trim()} className="w-full sm:w-auto">
                {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Mail className="h-4 w-4 mr-1.5" />}
                Envoyer l'invitation
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members list */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Membres actifs</CardTitle>
        </CardHeader>
        <CardContent>
          {!isLoaded ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-48" /></div>
                </div>
              ))}
            </div>
          ) : !memberships?.data?.length ? (
            <p className="text-sm text-text-tertiary text-center py-6">Aucun membre.</p>
          ) : (
            <div className="divide-y divide-border">
              {memberships.data.map((m) => {
                const member = m.publicUserData
                const name = [member?.firstName, member?.lastName].filter(Boolean).join(" ") || member?.identifier || "—"
                const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().substring(0, 2)
                const isAdmin = m.role === "org:admin"
                const isCurrentUser = member?.userId === user?.id

                return (
                  <div key={m.id} className="flex items-center gap-3 py-3">
                    <Avatar className="h-9 w-9">
                      {member?.imageUrl && <AvatarImage src={member.imageUrl} />}
                      <AvatarFallback className="bg-brand-primary/10 text-brand-primary text-sm font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">{name}{isCurrentUser && <span className="ml-1.5 text-xs text-text-tertiary">(vous)</span>}</p>
                      <p className="text-xs text-text-tertiary truncate">{member?.identifier}</p>
                    </div>
                    <Badge variant={isAdmin ? "default" : "secondary"}>
                      {isAdmin ? <><Crown className="h-3 w-3 mr-1" />Admin</> : <><User className="h-3 w-3 mr-1" />Membre</>}
                    </Badge>
                    {!isCurrentUser && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-text-tertiary hover:text-brand-danger"
                        disabled={removingId === m.id}
                        onClick={() => handleRemove(m.id)}
                      >
                        {removingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending invitations */}
      {!!invitations?.data?.length && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand-warning" /> Invitations en attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {invitations.data.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 py-3">
                  <div className="h-9 w-9 rounded-full bg-brand-warning/10 flex items-center justify-center">
                    <Mail className="h-4 w-4 text-brand-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">{inv.emailAddress}</p>
                    <p className="text-xs text-text-tertiary">{inv.role === "org:admin" ? "Admin" : "Membre"} · Invitation envoyée</p>
                  </div>
                  <Badge variant="outline" className="text-brand-warning border-brand-warning/30">En attente</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-text-tertiary hover:text-brand-danger"
                    disabled={revokingId === inv.id}
                    onClick={() => handleRevoke(inv.id)}
                  >
                    {revokingId === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
