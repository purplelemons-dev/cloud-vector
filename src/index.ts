import { OpenAI } from 'openai';
export interface Env {
	VECTOR_INDEX: VectorizeIndex;
	OPENAI_API_KEY: string;
	OPENAI_ORG: string;
	CLOUD_VECTOR_API_KEY: string;
}

export default {
	async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		console.log(req.url, req.method, req.headers.get("Authorization"));
		let path = new URL(req.url).pathname;
		if (path.startsWith("/favicon"))
			return new Response('', { status: 404 });

		const index = env.VECTOR_INDEX;
		const openai = new OpenAI({
			apiKey: env.OPENAI_API_KEY,
			organization: env.OPENAI_ORG,
		});

		if (req.method === "OPTIONS") {
			return new Response('', {
				headers: {
					"Access-Control-Allow-Origin": "https://lies.purplelemons.dev",
					"Access-Control-Allow-Methods": "POST, OPTIONS",
					"Access-Control-Allow-Headers": "Authorization, Content-Type",
				}
			});
		} else if (path === "/query" && req.method === "POST") {
			const { value }: {
				value: string;
			} = await req.json();

			const values = (await openai.embeddings.create({
				model: "text-embedding-ada-002",
				input: value,
			})).data[0].embedding;

			const result = (await index.query(values, {
				topK: 1,
			})).matches[0].id;
			return Response.json({
				id: result
			}, {
				headers: {
					"Access-Control-Allow-Origin": "https://lies.purplelemons.dev",
				}
			});
		} else if (path === "/add" && req.method === "POST") {
			if (req.headers.get("Authorization") !== `Bearer ${env.CLOUD_VECTOR_API_KEY}`) {
				return new Response("Unauthorized", { status: 401 });
			}
			const { id, value }: {
				id: string;
				value: string;
			} = await req.json();

			const values = (await openai.embeddings.create({
				model: "text-embedding-ada-002",
				input: value,
			})).data[0].embedding;

			const added = await index.insert([{ id, values }]);
			return Response.json(added);
		} else {
			return new Response('', { status: 404 });
		}
	}
};
