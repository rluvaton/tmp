import assert from "node:assert";
import { describe, it } from "node:test";

describe("Uploader", () => {
	describe("publishPackage", () => {
		describe("Package already published and no change needed", () => {
			it("should not publish package if package already exists and should not set to latest when no registry provided", async () => {
				// TODO -
			});

			it("should not publish package when package already exists and should not set to latest when registry provided", async () => {
				// TODO -
			});

			it("should not publish package if package already exists and latest and should set to latest when no registry provided", async () => {
				// TODO -
			});

			it("should not publish package if package already exists and latest and should set to latest when registry provided", async () => {
				// TODO -
			});
		});

		describe("Package published and should be marked as latest", () => {
			it("should only set package dist tag to be latest when package already exists and is not latest while it should when no registry provided", async () => {
				// TODO -
			});

			it("should only set package dist tag to be latest when package already exists and is not latest while it should when registry provided", async () => {
				// TODO -
			});
		});

		// TODO - add more tests
	});
});
