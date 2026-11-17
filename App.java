import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.concurrent.Executors;

public class App {
    private static final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5)).build();

    public static void main(String[] args) throws Exception {
        String host = System.getenv().getOrDefault("HOST", "127.0.0.1");
        HttpServer server = HttpServer.create(new InetSocketAddress(host, 5000), 0);
        // A slow service response must not block other browser requests.
        server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());

        server.createContext("/delivery/", App::serveDeliveryAsset);
        server.createContext("/api/dcm/", exchange -> forward(exchange, "/api/dcm", "DCM_BASE_URL"));
        server.createContext("/api/routing/", exchange -> forward(exchange, "/api/routing", "ROUTING_BASE_URL"));
        server.createContext("/api/location/", exchange -> forward(exchange, "/api/location", "LOCATION_BASE_URL"));
        server.createContext("/api/sync", App::fakeSync);

        server.createContext("/", exchange -> {
            byte[] body = Files.readAllBytes(Path.of("home/home.html"));
            exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

        server.createContext("/Account", exchange -> {
            byte[] body = Files.readAllBytes(Path.of("home/account.html"));
            exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

        server.createContext("/User", exchange -> {
            byte[] body = Files.readAllBytes(Path.of("frontend/frontend.html"));
            exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

        server.createContext("/Warehouse", exchange -> {
            byte[] body = Files.readAllBytes(Path.of("warehouse/warehouse.html"));
            exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

        server.createContext("/Delivery", exchange -> {
            byte[] body = Files.readAllBytes(Path.of("delivery/delivery.html"));
            exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

        server.createContext("/css/", exchange -> {
            String filename = exchange.getRequestURI().getPath()
                    .replace("/css/", "");

            if (!filename.matches("[a-zA-Z0-9_-]+\\.css")) {
                exchange.sendResponseHeaders(400, -1);
                exchange.close();
                return;
            }

            Path file = Path.of("css", filename);

            if (!Files.isRegularFile(file)) {
                exchange.sendResponseHeaders(404, -1);
                exchange.close();
                return;
            }

            byte[] body = Files.readAllBytes(file);

            exchange.getResponseHeaders().set("Content-Type", "text/css; charset=utf-8");
            exchange.sendResponseHeaders(200, body.length);

            try (var output = exchange.getResponseBody()) {
                output.write(body);
            }
        });
        
        server.createContext("/videos/", exchange -> {
            String filename = exchange.getRequestURI().getPath().replace("/videos/", "");

            if (!filename.matches("[a-zA-Z0-9_-]+\\.png")) {
                exchange.sendResponseHeaders(400, -1);
                exchange.close();
                return;
            }

            Path imagePath = Path.of("videos", filename);

            if (!Files.exists(imagePath)) {
                exchange.sendResponseHeaders(404, -1);
                exchange.close();
                return;
            }

            byte[] image = Files.readAllBytes(imagePath);

            exchange.getResponseHeaders().set("Content-Type", "image/png");
            exchange.sendResponseHeaders(200, image.length);

            try (var output = exchange.getResponseBody()) {
                output.write(image);
            }
        });

        server.createContext("/routes/", exchange -> {

            String filename = exchange.getRequestURI().getPath().replace("/routes/", "");

            if (!filename.matches("[a-zA-Z0-9_-]+\\.geojson")) {
                exchange.sendResponseHeaders(400, -1);
                exchange.close();
                return;
            }

            Path routesFolder = Path.of("delivery/routes").toAbsolutePath().normalize();

            Path file = routesFolder.resolve(filename).normalize();

            if (!file.startsWith(routesFolder) || !Files.exists(file)) {
                exchange.sendResponseHeaders(404, -1);
                exchange.close();
                return;
            }

            byte[] body = Files.readAllBytes(file);

            exchange.getResponseHeaders().set("Content-Type", "application/geo+json");

            exchange.sendResponseHeaders(200, body.length);

            try (var output = exchange.getResponseBody()) {
                output.write(body);
            }
        });

        server.start();
        System.out.println("Running on http://" + host + ":5000");
    }

    // Serve only public driver assets, never files from the frozen test suite.
    private static void serveDeliveryAsset(HttpExchange exchange) throws IOException {
        String name = exchange.getRequestURI().getPath().substring("/delivery/".length());
        boolean publicAsset = name.equals("driver.js") || name.equals("driver.css")
                || name.matches("vendor/leaflet/(leaflet\\.(js|css)|images/[a-zA-Z0-9_-]+\\.png)");
        if (!exchange.getRequestMethod().equals("GET") || !publicAsset) {
            respond(exchange, 404, "text/plain", "Not found".getBytes());
            return;
        }
        Path file = Path.of("delivery", name);
        if (!Files.isRegularFile(file)) {
            respond(exchange, 404, "text/plain", "Not found".getBytes());
            return;
        }
        String type = name.endsWith(".js") ? "text/javascript; charset=utf-8"
                : name.endsWith(".css") ? "text/css; charset=utf-8" : "image/png";
        respond(exchange, 200, type, Files.readAllBytes(file));
    }

    // POC stub: receive navigation and acknowledge it without storing or processing it.
    private static void fakeSync(HttpExchange exchange) throws IOException {
        if (!exchange.getRequestURI().getRawPath().equals("/api/sync")) {
            respond(exchange, 404, "application/json", "{\"error\":\"Not found\"}".getBytes());
            return;
        }
        if (!exchange.getRequestMethod().equals("POST")) {
            exchange.getResponseHeaders().set("Allow", "POST");
            respond(exchange, 405, "application/json", "{\"error\":\"Method not allowed\"}".getBytes());
            return;
        }
        String contentType = exchange.getRequestHeaders().getFirst("Content-Type");
        if (contentType == null || !contentType.split(";", 2)[0].trim().equalsIgnoreCase("application/json")) {
            respond(exchange, 415, "application/json", "{\"error\":\"JSON required\"}".getBytes());
            return;
        }
        // Use the same 64 KiB request limit as the forwarding handlers.
        byte[] navigation = exchange.getRequestBody().readNBytes(65537);
        if (navigation.length > 65536) {
            respond(exchange, 413, "application/json", "{\"error\":\"Request too large\"}".getBytes());
            return;
        }
        if (navigation.length == 0) {
            respond(exchange, 400, "application/json", "{\"error\":\"Navigation required\"}".getBytes());
            return;
        }
        respond(exchange, 200, "application/json", "true".getBytes());
    }

    // Forward requests to configured services; task progression stays in DCM.
    private static void forward(HttpExchange exchange, String prefix, String environmentKey) throws IOException {
        String baseUrl = System.getenv(environmentKey);
        if (baseUrl == null || baseUrl.isBlank()) {
            respond(exchange, 503, "application/json", "{\"error\":\"Service not configured\"}".getBytes());
            return;
        }
        String method = exchange.getRequestMethod();
        if (!method.equals("GET") && !method.equals("POST")) {
            respond(exchange, 405, "application/json", "{\"error\":\"Method not allowed\"}".getBytes());
            return;
        }
        // Remove the gateway prefix before forwarding the service's own path and query.
        String path = exchange.getRequestURI().getRawPath().substring(prefix.length());
        if (path.contains("..") || path.contains("%") || path.contains("\\")) {
            respond(exchange, 400, "application/json", "{\"error\":\"Invalid path\"}".getBytes());
            return;
        }
        String query = exchange.getRequestURI().getRawQuery();
        try {
            URI target = URI.create(baseUrl.replaceAll("/+$", "") + path + (query == null ? "" : "?" + query));
            byte[] body = exchange.getRequestBody().readNBytes(65537);
            if (body.length > 65536) {
                respond(exchange, 413, "application/json", "{\"error\":\"Request too large\"}".getBytes());
                return;
            }
            HttpRequest request = HttpRequest.newBuilder(target)
                    .timeout(Duration.ofSeconds(5))
                    .header("Content-Type", "application/json")
                    .method(method, body.length == 0 ? HttpRequest.BodyPublishers.noBody()
                            : HttpRequest.BodyPublishers.ofByteArray(body))
                    .build();
            HttpResponse<byte[]> response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());
            respond(exchange, response.statusCode(), response.headers().firstValue("Content-Type")
                    .orElse("application/json"), response.body());
        } catch (HttpTimeoutException exception) {
            respond(exchange, 504, "application/json", "{\"error\":\"Service timed out\"}".getBytes());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            respond(exchange, 502, "application/json", "{\"error\":\"Service interrupted\"}".getBytes());
        } catch (IOException | IllegalArgumentException exception) {
            respond(exchange, 502, "application/json", "{\"error\":\"Service unavailable\"}".getBytes());
        }
    }

    private static void respond(HttpExchange exchange, int status, String contentType, byte[] body) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        exchange.getResponseHeaders().set("Cache-Control", "no-store");
        exchange.sendResponseHeaders(status, body.length);
        try (var output = exchange.getResponseBody()) {
            output.write(body);
        }
    }
}
