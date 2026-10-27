export type NavData = {
  labels: {
    home: string;
    team: string;
    services: string;
    allServices: string;
    agent: string;
    ressources: string;
    about: string;
    contact: string;
    mobileNavigation: string;
  };
  services: Array<{
    href: string;
    title: string;
    description: string;
  }>;
};
