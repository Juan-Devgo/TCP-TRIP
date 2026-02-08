declare module "astro:actions" {
	type Actions = typeof import("/home/juandevgo/Desktop/Uniquindío/Trabajo de Grado/APP GRID/App/tcp-trip/src/actions/index.ts")["server"];

	export const actions: Actions;
}