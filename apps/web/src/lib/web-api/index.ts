import * as tenants from "./tenants";
import * as businesses from "./businesses";
import * as schedules from "./schedules";
import * as catalog from "./catalog";
import * as faqs from "./faqs";
import * as conversations from "./conversations";
import * as appointments from "./appointments";
import * as orders from "./orders";
import * as payments from "./payments";
import * as analytics from "./analytics";
import * as messages from "./messages";

export const webApi = {
  tenants,
  businesses,
  schedules,
  catalog,
  faqs,
  conversations,
  appointments,
  orders,
  payments,
  analytics,
  messages,
};

export { WebApiError } from "./client";
