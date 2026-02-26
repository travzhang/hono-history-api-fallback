/**
 * connect-history-api-fallback 的 Hono 实现
 * 行为与 https://github.com/bripkens/connect-history-api-fallback 一致
 * 用于 SPA 的 HTML5 History 路由 fallback
 */
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import type { MiddlewareHandler } from "hono";

export interface HistoryApiFallbackOptions {
    /** 静态文件根目录，用于解析 index 路径 */
    root: string;
    /** 重写目标，默认 /index.html */
    index?: string;
    /** 自定义重写规则，会与默认规则合并（默认含 GitLab 风格 /-/ 路径） */
    rewrites?: {
        from: RegExp;
        to: string | ((ctx: { parsedUrl: URL; match: RegExpMatchArray }) => string);
    }[];
    /** Accept 头匹配列表，默认包含 text/html 与任意类型 */
    htmlAcceptHeaders?: string[];
    /** 禁用点规则（路径含 . 视为文件请求） */
    disableDotRule?: boolean;
    /** 是否输出日志 */
    verbose?: boolean;
    /** 自定义日志函数 */
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
