export const transitFixture = `export default {
    async fetch(request) {
        const url = new URL(request.url);
        if (!['berlin', 'leipzig', 'hamburg'].includes(url.searchParams.get('city'))) return new Response(null, {status: 400});
        if (url.pathname === '/v0/transit/stations') return Response.json({
            ...Object.fromEntries(Array.from({length:7},(_,i)=>['station-'+(i+1),{name:'Stop & <'+(i+1)+'>'}])),
            'station-a': {name: 'A & <B>'}, 'station-b': {name: 'C'}
        });
        if (url.pathname === '/v0/transit/lines') return Response.json([
            {id: 'line-a', name: 'L<1>', stations: ['station-a', 'station-b']}
        ]);
        return new Response(null, {status: 404});
    }
}`
