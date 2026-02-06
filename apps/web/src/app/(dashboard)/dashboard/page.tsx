import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma, type Installation, type Repository } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type InstallationWithRepos = Installation & { repositories: Repository[] };

async function getInstallationsForUser(
  userId: string
): Promise<InstallationWithRepos[]> {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "github" },
  });

  if (!account) return [];

  const githubAccountId = parseInt(account.accountId, 10);

  return prisma.installation.findMany({
    where: {
      OR: [{ linkedUserId: userId }, { githubAccountId }],
    },
    include: {
      repositories: {
        orderBy: { fullName: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  const installations = await getInstallationsForUser(session.user.id);
  const totalRepos = installations.reduce(
    (sum, inst) => sum + inst.repositories.length,
    0
  );

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your Prism installations and repositories.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Installations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">
              {installations.length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Repositories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">{totalRepos}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="text-sm font-medium text-primary">Active</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {installations.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="py-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
              <svg
                className="h-6 w-6 text-muted-foreground"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                <path d="M9 18c-4.51 2-5-2-7-2" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold mb-1">No installations yet</h2>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
              Install Prism on your GitHub repositories to get started with PR
              previews.
            </p>
            <Button asChild>
              <a
                href={`https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new`}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                Install Prism on GitHub
              </a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent Repositories</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/repos">
                View all
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            </Button>
          </div>
          <div className="space-y-1.5">
            {installations
              .flatMap((inst) =>
                inst.repositories.map((repo) => ({
                  ...repo,
                  installation: inst,
                }))
              )
              .slice(0, 5)
              .map((repo) => (
                <Card
                  key={repo.id}
                  className="border-border/50 py-0 hover:border-border transition-colors"
                >
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarImage
                          src={
                            repo.installation.githubAccountAvatarUrl ??
                            undefined
                          }
                          alt={repo.installation.githubAccountLogin}
                        />
                        <AvatarFallback>
                          {repo.installation.githubAccountLogin
                            .charAt(0)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
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
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {repo.defaultBranch}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="xs" asChild>
                      <a
                        href={`https://github.com/${repo.fullName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        </div>
      )}
    </div>
  );
}
