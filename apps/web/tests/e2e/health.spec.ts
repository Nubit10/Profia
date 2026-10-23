import { expect, test } from "./fixtures";

test("CA-0001-01: la app arranca y /api/health responde 200 con la base conectada", async ({
  request,
}) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", db: "ok" });
});
