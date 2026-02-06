import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma, type Installation, type Repository } from "@repo/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

type InstallationWithRepos = Installation & { repositories: Repository[] };

async function getInstallationsWithRepos(
  userId: string
): Promise<{
  personal: InstallationWithRepos[];
  orgs: InstallationWithRepos[];
}> {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "github" },
  });

  if (!account) return { personal: [], orgs: [] };

  const githubAccountId = parseInt(account.accountId, 10);

  const installations = await prisma.installation.findMany({
    where: {
      OR: [{ linkedUserId: userId }, { githubAccountId }],
    },
    include: {
      repositories: {
        orderBy: { fullName: "asc" },
      },
    },
    orderBy: { githubAccountLogin: "asc" },
  });

  const personal = installations.filter(
    (inst) => inst.githubAccountType === "User"
  );
  const orgs = installations.filter(
    (inst) => inst.githubAccountType === "Organization"
  );

  return { personal, orgs };
}

export default async function ReposPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  const { personal, orgs } = await getInstallationsWithRepos(session.user.id);
  const allInstallations = [...personal, ...orgs];

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Repositories
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All repositories with Prism installed.
          </p>
        </div>
        <Button asChild>
          <a
            href={`https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new`}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add repositories
          </a>
        </Button>
      </div>

      {allInstallations.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No repositories found. Install Prism on GitHub to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {personal.length > 0 && (
            <InstallationGroup title="Personal" installations={personal} />
          )}
          {orgs.map((inst) => (
            <InstallationGroup
              key={inst.id}
              title={inst.githubAccountLogin}
              avatarUrl={inst.githubAccountAvatarUrl}
              installations={[inst]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InstallationGroup({
  title,
  avatarUrl,
  installations,
}: {
  title: string;
  avatarUrl?: string | null;
  installations: InstallationWithRepos[];
}) {
  const repos = installations.flatMap((inst) =>
    inst.repositories.map((repo) => ({
      ...repo,
      installationLogin: inst.githubAccountLogin,
      installationAvatarUrl: inst.githubAccountAvatarUrl,
      repositorySelection: inst.repositorySelection,
    }))
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {avatarUrl ? (
          <Avatar size="sm">
            <AvatarImage src={avatarUrl} alt={title} />
            <AvatarFallback>{title.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
            <svg
              className="h-3 w-3 text-muted-foreground"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        )}
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </h2>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {repos.length}
        </Badge>
      </div>

      {repos.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground font-mono">
              {installations[0]?.repositorySelection === "all"
                ? "all repositories — repos will appear as PRs are opened"
                : "no repositories selected for this installation"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {repos.map((repo) => (
            <Card
              key={repo.id}
              className="border-border/50 py-0 hover:border-border transition-colors"
            >
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium font-mono">
                    {repo.fullName}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge
                      variant={repo.private ? "outline" : "secondary"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {repo.private ? "private" : "public"}
                    </Badge>
                    <Separator
                      orientation="vertical"
                      className="h-3 bg-border"
                    />
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {repo.defaultBranch}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="xs" asChild>
                  <a
                    href={`https://github.com/${repo.fullName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
