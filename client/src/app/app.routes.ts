import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: `admin-routing`,
    title: `Admin routing`,
    loadComponent: () =>
      import(`./admin-routing/admin-routing.component`).then(
        (c) => c.AdminRoutingComponent
      ),
  },

  { path: `**`, redirectTo: `/admin-routing` },
];
