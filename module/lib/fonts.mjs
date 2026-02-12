
export class Fonts {
	static register() {		
		foundry.applications.settings.menus.FontConfig.loadFont("CaslonAntique", {
			editor: true,
			fonts: [
				{
					name: "CaslonAntique",
					urls: ["systems/mist-engine-fvtt/assets/fonts/caslon.ttf"],
					sizeAdjust: "110%",
				},
				{
					name: "CaslonAntique",
					urls: ["systems/mist-engine-fvtt/assets/fonts/caslon-b.ttf"],
					weight: "bold",
					sizeAdjust: "110%",
				},
				{
					name: "CaslonAntique",
					urls: ["systems/mist-engine-fvtt/assets/fonts/caslon-i.ttf"],
					style: "italic",
					sizeAdjust: "110%",
				},
			],
		});
		foundry.applications.settings.menus.FontConfig.loadFont("Fraunces", {
			editor: true,
			fonts: [
				{
					name: "Fraunces",
					urls: ["systems/mist-engine-fvtt/assets/fonts/fraunces.ttf"],
					weight: "300 800",
				},
				{
					name: "Fraunces",
					urls: ["systems/mist-engine-fvtt/assets/fonts/fraunces-i.ttf"],
					style: "italic",
					weight: "300 800",
				},
			],
		});
		foundry.applications.settings.menus.FontConfig.loadFont("AlchemyItalic", {
			editor: true,
			fonts: [
				{
					name: "AlchemyItalic",
					urls: ["systems/mist-engine-fvtt/assets/fonts/alchemy-i.ttf"],
				},
			],
		});
		foundry.applications.settings.menus.FontConfig.loadFont("PackardAntique", {
			editor: true,
			fonts: [
				{
					name: "PackardAntique",
					urls: ["systems/mist-engine-fvtt/assets/fonts/packard.ttf"],
				},
				{
					name: "PackardAntique",
					urls: ["systems/mist-engine-fvtt/assets/fonts/packard-b.ttf"],
					weight: "bold",
				},
			],
		});
		foundry.applications.settings.menus.FontConfig.loadFont("PowellAntique", {
			editor: true,
			fonts: [
				{
					name: "PowellAntique",
					urls: ["systems/mist-engine-fvtt/assets/fonts/powell.ttf"],
				},
				{
					name: "PowellAntique",
					urls: ["systems/mist-engine-fvtt/assets/fonts/powell-b.ttf"],
					weight: "bold",
				},
			],
		});
	}
}
