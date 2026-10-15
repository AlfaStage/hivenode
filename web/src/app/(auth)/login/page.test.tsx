import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import LoginPage from "./page";
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
afterEach(() => { vi.unstubAllGlobals(); push.mockClear(); });
it("submits browser-filled values and ignores stale local tokens", async () => {
  const getItem = vi.fn(() => "expired-token");
  vi.stubGlobal("localStorage", { getItem });
  vi.stubGlobal("FormData", window.FormData);
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }));
  vi.stubGlobal("fetch", fetchMock);
  render(<LoginPage />);
  expect(getItem).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
  const email = screen.getByLabelText("E-mail") as HTMLInputElement;
  const password = screen.getByLabelText("Senha") as HTMLInputElement;
  email.value = "customer@example.com";
  password.value = "Native-Filled-Password-123!";
  const form = email.closest("form")!;
  expect(form.method).toBe("post");
  fireEvent.submit(form);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({
    body: JSON.stringify({ email: email.value, password: password.value }),
  })));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
});
