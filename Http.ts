import * as Http from "http";
import * as Https from "https";
import * as Url from "url";

export function httpFetch(url: string, content: string, contentType = "application/json; charset=utf-8", secured = true, timeoutMS = 10000) {
    let
        temp = Url.parse(url),
        options: Https.RequestOptions = {
            hostname: temp.hostname,
            port: Number.parseInt(temp.port),
            path: temp.path,
            protocol: temp.protocol,
            method: "GET",
            timeout: timeoutMS,
            headers: {}
        };

    if (content) {
        options.method = "POST";
        options.headers["Content-Type"] = contentType;
        options.headers["Content-Length"] = Buffer.byteLength(content, "utf8");
    }

    options.rejectUnauthorized = secured;

    let
        requestFn = temp.protocol === "http:" ? Http.request : Https.request;

    return new Promise<string>((resolve, reject) => {
        let
            request = requestFn(options, (response) => {
                if (response.statusCode < 200 || response.statusCode > 299)
                    reject(new Error(`Http fetch failed, status = ${response.statusCode}, ${response.statusMessage}`));
                else {
                    response.setEncoding("utf8");

                    let
                        data = "";
                    response.on("data", (chunk) => {
                        data += chunk;
                    });
                    response.on("end", () => {
                        resolve(data);
                    });
                }
            });

        request.on("error", (ex) => {
            reject(ex)
        });

        if (content != null)
            request.write(content);

        request.end();
    });
}