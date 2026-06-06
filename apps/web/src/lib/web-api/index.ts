import * as tenants from "./tenants";
import * as businesses from "./businesses";
import * as schedules from "./schedules";
import * as catalog from "./catalog";
import * as faqs from "./faqs";
import * as conversations from "./conversations";
import * as appointments from "./appointments";
import * as payments from "./payments";
import * as analytics from "./analytics";

export const webApi = {
  tenants,
  businesses,
  schedules,
  catalog,
  faqs,
  conversations,
  appointments,
  payments,
  analytics,
};

export { WebApiError } from "./client";
