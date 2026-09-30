"use client";

import { Building2, ListChecks, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgencyOnboarding } from "./agency-onboarding";
import { ClientOnboarding } from "./client-onboarding";
import { TemplatesView } from "./templates-view";

export function OnboardingHub() {
  return (
    <div>
      <PageHeader
        eyebrow="Module 11 · Client & agency onboarding"
        depth="demo"
        title="Onboarding"
        description="Growth OS–style questionnaires plus the onboarding checklist. The essential questions unlock the work; the deeper ones follow within 7 days, with Genie Assistant reminders."
      />
      <Tabs defaultValue="clients">
        <TabsList>
          <TabsTrigger value="clients">
            <Users /> Clients
          </TabsTrigger>
          <TabsTrigger value="agency">
            <Building2 /> Agency · Genie Magnet
          </TabsTrigger>
          <TabsTrigger value="templates">
            <ListChecks /> Question templates
          </TabsTrigger>
        </TabsList>
        <TabsContent value="clients">
          <ClientOnboarding />
        </TabsContent>
        <TabsContent value="agency">
          <AgencyOnboarding />
        </TabsContent>
        <TabsContent value="templates">
          <TemplatesView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
