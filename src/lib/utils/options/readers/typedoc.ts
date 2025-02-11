import { join, dirname, resolve } from "path";
import * as FS from "fs";
import ts from "typescript";

import type { OptionsReader } from "..";
import type { Logger } from "../../loggers";
import type { Options } from "../options";
import { ok } from "assert";
import { nicePath, normalizePath } from "../../paths";
import { isFile } from "../../fs";
import { createRequire } from "module";
import { pathToFileURL } from "url";

/**
 * Obtains option values from typedoc.json
 *
 * Changes need to happen here at some point. I think we should follow ESLint's new config
 * system eventually: https://eslint.org/blog/2022/08/new-config-system-part-1/
 */
export class TypeDocReader implements OptionsReader {
    /**
     * Should run before the tsconfig reader so that it can specify a tsconfig file to read.
     */
    order = 100;

    name = "typedoc-json";

    supportsPackages = true;

    /**
     * Read user configuration from a typedoc.json or typedoc.js configuration file.
     */
    async read(container: Options, logger: Logger, cwd: string): Promise<void> {
        const path = container.getValue("options") || cwd;
        const file = this.findTypedocFile(path);

        if (!file) {
            if (container.isSet("options")) {
                logger.error(
                    `The options file ${nicePath(path)} does not exist.`,
                );
            }
            return;
        }

        const seen = new Set<string>();
        await this.readFile(file, container, logger, seen);
    }

    /**
     * Read the given options file + any extended files.
     * @param file
     * @param container
     * @param logger
     */
    private async readFile(
        file: string,
        container: Options & { setValue(key: string, value: unknown): void },
        logger: Logger,
        seen: Set<string>,
    ) {
        if (seen.has(file)) {
            logger.error(
                `Tried to load the options file ${nicePath(
                    file,
                )} multiple times.`,
            );
            return;
        }
        seen.add(file);

        let fileContent: any;
        if (file.endsWith(".json")) {
            const readResult = ts.readConfigFile(normalizePath(file), (path) =>
                FS.readFileSync(path, "utf-8"),
            );

            if (readResult.error) {
                logger.error(
                    `Failed to parse ${nicePath(
                        file,
                    )}, ensure it exists and contains an object.`,
                );
                return;
            } else {
                fileContent = readResult.config;
            }
        } else {
            try {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    fileContent = await require(file);
                } catch (error: any) {
                    if (error?.code === "ERR_REQUIRE_ESM") {
                        // On Windows, we need to ensure this path is a file path.
                        // Or we'll get ERR_UNSUPPORTED_ESM_URL_SCHEME
                        const esmPath = pathToFileURL(file).toString();
                        fileContent = await (await import(esmPath)).default;
                    } else {
                        throw error;
                    }
                }
            } catch (error) {
                logger.error(
                    `Failed to read ${nicePath(file)}: ${
                        error instanceof Error ? error.message : error
                    }`,
                );
                return;
            }
        }

        if (typeof fileContent !== "object" || !fileContent) {
            logger.error(
                `The root value of ${nicePath(file)} is not an object.`,
            );
            return;
        }

        // clone option object to avoid of property changes in re-calling this file
        const data = { ...fileContent };
        delete data["$schema"]; // Useful for better autocompletion, should not be read as a key.

        if ("extends" in data) {
            const resolver = createRequire(file);
            const extended: string[] = getStringArray(data["extends"]);
            for (const extendedFile of extended) {
                let resolvedParent: string;
                try {
                    resolvedParent = resolver.resolve(extendedFile);
                } catch {
                    logger.error(
                        `Failed to resolve ${extendedFile} to a file in ${nicePath(
                            file,
                        )}`,
                    );
                    continue;
                }
                await this.readFile(resolvedParent, container, logger, seen);
            }
            delete data["extends"];
        }

        for (const [key, val] of Object.entries(data)) {
            try {
                container.setValue(
                    key as never,
                    val as never,
                    resolve(dirname(file)),
                );
            } catch (error) {
                ok(error instanceof Error);
                logger.error(error.message);
            }
        }
    }

    /**
     * Search for the configuration file given path
     *
     * @param  path Path to the typedoc.(js|json) file. If path is a directory
     *   typedoc file will be attempted to be found at the root of this path
     * @param logger
     * @return the typedoc.(js|json) file path or undefined
     */
    private findTypedocFile(path: string): string | undefined {
        path = resolve(path);

        return [
            path,
            join(path, "typedoc.json"),
            join(path, "typedoc.jsonc"),
            join(path, "typedoc.config.js"),
            join(path, "typedoc.config.cjs"),
            join(path, "typedoc.config.mjs"),
            join(path, "typedoc.js"),
            join(path, "typedoc.cjs"),
            join(path, "typedoc.mjs"),
            join(path, ".config/typedoc.json"),
            join(path, ".config/typedoc.jsonc"),
            join(path, ".config/typedoc.config.js"),
            join(path, ".config/typedoc.config.cjs"),
            join(path, ".config/typedoc.config.mjs"),
            join(path, ".config/typedoc.js"),
            join(path, ".config/typedoc.cjs"),
            join(path, ".config/typedoc.mjs"),
        ].find(isFile);
    }
}

function getStringArray(arg: unknown): string[] {
    return Array.isArray(arg) ? arg.map(String) : [String(arg)];
}
