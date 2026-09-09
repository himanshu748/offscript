import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { components } from "./_generated/api";

const http = httpRouter();

auth.addHttpRoutes(http);
registerStaticRoutes(http, components.staticHosting);

export default http;
