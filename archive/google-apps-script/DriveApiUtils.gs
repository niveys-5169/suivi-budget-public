function driveApi_getOrCreateFolder(name, parentId) {
  const safeName = String(name).replace(/'/g, "\\'");
  const qParts = [
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
    `name='${safeName}'`
  ];
  if (parentId) qParts.push(`'${parentId}' in parents`);

  const res = Drive.Files.list({
    q: qParts.join(' and '),
    fields: 'files(id,name)',
    pageSize: 10
  });

  if (res.files && res.files.length) return res.files[0].id;

  const resource = {
    name: name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: parentId ? [parentId] : undefined
  };

  const created = Drive.Files.create(resource);
  return created.id;
}
