/**
 * Hono port of connect-history-api-fallback.
 * Behavior aligns with https://github.com/bripkens/connect-history-api-fallback
 * for SPA HTML5 History routing fallback.
 */
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import type { MiddlewareHandler } from "hono";

export interface HistoryApiFallbackOptions {
    /** Static file root directory; used to resolve the index and rewritten paths */
    root: string;
    /** Rewrite target path; defaults to `/index.html` */
    index?: string;
    /** Custom rewrite rules merged with defaults (includes GitLab-style `/-/` paths) */
    rewrites?: {
        from: RegExp;
        to: string | ((ctx: { parsedUrl: URL; match: RegExpMatchArray }) => string);
    }[];
    /** Accept header tokens to treat as HTML requests; defaults include text/html and the any-type wildcard */
    htmlAcceptHeaders?: string[];
    /** Disable the dot rule (paths containing `.` after the last `/` are treated as file requests) */
    disableDotRule?: boolean;
    /** Enable verbose logging */
    verbose?: boolean;
    /** Custom logger (defaults to `console.log` when `verbose` is true) */
    logger?: (...args: unknown[]) => void;
}

export function historyApiFallback(options: HistoryApiFallbackOptions): MiddlewareHandler {
    const { root } = options;
    const index = options.index ?? "/index.html";
    const rewrites = [
        ...(options.rewrites ?? []),
        { from: /\/-\//, to: index },
    ];
    const htmlAcceptHeaders = options.htmlAcceptHeaders ?? ["text/html", "*/*"];
    const disableDotRule = options.disableDotRule ?? false;
    const logger =
        options.logger ?? (options.verbose ? (...args: unknown[]) => console.log(...args) : () => {});

    const acceptsHtml = (header: string) =>
        htmlAcceptHeaders.some((h) => header.indexOf(h) !== -1);

    return async (c, next) => {
        const method = c.req.method;
        const url = new URL(c.req.url);
        const pathname = url.pathname;
        const acceptHeader = c.req.header("Accept") ?? "";

        if (method !== "GET" && method !== "HEAD") {
            logger("Not rewriting", method, c.req.url, "because the method is not GET or HEAD.");
            return next();
        }
        if (typeof acceptHeader !== "string") {
            logger("Not rewriting", method, c.req.url, "because the client did not send an HTTP accept header.");
            return next();
        }
        if (acceptHeader.indexOf("application/json") === 0) {
            logger("Not rewriting", method, c.req.url, "because the client prefers JSON.");
            return next();
        }
        if (!acceptsHtml(acceptHeader)) {
            logger("Not rewriting", method, c.req.url, "because the client does not accept HTML.");
            return next();
        }

        for (const rewrite of rewrites) {
            const match = pathname.match(rewrite.from);
            if (match !== null) {
                const rewriteTarget =
                    typeof rewrite.to === "string"
                        ? rewrite.to
                        : rewrite.to({ parsedUrl: url, match });
                logger("Rewriting", method, c.req.url, "to", rewriteTarget);
                const filePath = join(root, rewriteTarget.replace(/^\//, ""));
                if (existsSync(filePath)) {
                    return c.html(readFileSync(filePath, "utf-8"));
                }
                return next();
            }
        }

        const lastDot = pathname.lastIndexOf(".");
        const lastSlash = pathname.lastIndexOf("/");
        if (lastDot > lastSlash && !disableDotRule) {
            logger("Not rewriting", method, c.req.url, "because the path includes a dot (.) character.");
            return next();
        }

        logger("Rewriting", method, c.req.url, "to", index);
        const indexPath = join(root, index.replace(/^\//, ""));
        if (existsSync(indexPath)) {
            return c.html(readFileSync(indexPath, "utf-8"));
        }
        return next();
    };
}
