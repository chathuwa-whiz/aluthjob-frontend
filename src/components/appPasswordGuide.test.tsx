import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppPasswordGuide, providerOf } from "./AppPasswordGuide";

describe("app password guide", () => {
  it("recognises the provider from the address being typed", () => {
    expect(providerOf("gmail.com")).toBe("gmail");
    expect(providerOf("googlemail.com")).toBe("gmail");
    expect(providerOf("yahoo.com")).toBe("yahoo");
    expect(providerOf("hotmail.com")).toBe("outlook");
    expect(providerOf("acme.lk")).toBe("other");
    expect(providerOf("")).toBeUndefined();
    expect(providerOf("gma")).toBeUndefined();
  });

  it("starts on Gmail with links that open Google's own pages in a new tab", () => {
    render(<AppPasswordGuide defaultOpen />);

    expect(screen.getByRole("tab", { name: "Gmail" })).toHaveAttribute("aria-selected", "true");
    const link = screen.getByRole("link", { name: /Open app passwords/ });
    expect(link).toHaveAttribute("href", "https://myaccount.google.com/apppasswords");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getByRole("link", { name: /Open 2-Step Verification/ })).toBeInTheDocument();
  });

  it("follows the address, and says honestly that Outlook may refuse app passwords", () => {
    const { rerender } = render(<AppPasswordGuide domain="yahoo.com" defaultOpen />);
    expect(screen.getByRole("tab", { name: "Yahoo" })).toHaveAttribute("aria-selected", "true");

    rerender(<AppPasswordGuide domain="hotmail.com" defaultOpen />);
    expect(screen.getByRole("tab", { name: "Outlook" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Outlook and Hotmail may not work")).toBeInTheDocument();
  });

  it("lets the person choose a provider themselves", async () => {
    render(<AppPasswordGuide defaultOpen />);

    await userEvent.click(screen.getByRole("tab", { name: "Yahoo" }));
    expect(screen.getByRole("link", { name: /Open Yahoo security/ })).toBeInTheDocument();
  });

  it("is closed until asked for", () => {
    const { container } = render(<AppPasswordGuide />);
    expect(container.querySelector("details")).not.toHaveAttribute("open");
  });
});
