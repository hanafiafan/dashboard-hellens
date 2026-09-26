import fs from 'node:fs/promises'
import path from 'node:path'
const metadata=await fetch('https://api.polyhaven.com/files/stationery_supplies').then(r=>r.json())
const asset=metadata.gltf['1k'].gltf
for(const [name,entry] of Object.entries({'stationery.gltf':asset,...asset.include})) {
  const response=await fetch(entry.url)
  if(!response.ok)throw new Error(`${response.status}: ${entry.url}`)
  const target=path.join('public/models/stationery',name)
  await fs.mkdir(path.dirname(target),{recursive:true})
  await fs.writeFile(target,Buffer.from(await response.arrayBuffer()))
  console.log(name)
}
