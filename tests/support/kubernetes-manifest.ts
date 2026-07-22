type JsonObject = Record<string, unknown>
type Validator = (manifest: JsonObject, location: string) => void
type PodSpecContext = 'deployment' | 'job' | 'pod'

/**
 * Focused offline validators target the built-in APIs documented for Kubernetes
 * v1.31: https://v1-31.docs.kubernetes.io/docs/reference/kubernetes-api/
 * This is an explicit example contract, not a replacement for the full OpenAPI
 * schema. Every manifest kind in public docs must have a validator below.
 */
export const KUBERNETES_SCHEMA_TARGET = 'v1.31'

function fail(location: string, path: string, message: string): never {
  throw new Error(`${location} ${path} ${message}`)
}

function object(value: unknown, location: string, path: string): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(location, path, 'must be an object')
  }
  return value as JsonObject
}

function array(value: unknown, location: string, path: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail(location, path, 'must be a non-empty array')
  }
  return value
}

function possiblyEmptyArray(
  value: unknown,
  location: string,
  path: string,
): unknown[] {
  if (!Array.isArray(value)) fail(location, path, 'must be an array')
  return value
}

function string(value: unknown, location: string, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    fail(location, path, 'must be a non-empty string')
  }
  return value
}

function stringArray(value: unknown, location: string, path: string): string[] {
  return array(value, location, path).map((entry, index) =>
    string(entry, location, `${path}[${index}]`),
  )
}

function optionalString(value: unknown, location: string, path: string): void {
  if (value !== undefined) string(value, location, path)
}

function labels(value: unknown, location: string, path: string): JsonObject {
  const result = object(value, location, path)
  for (const [key, label] of Object.entries(result)) {
    string(key, location, `${path} key`)
    string(label, location, `${path}.${key}`)
  }
  return result
}

function validateResourceValues(
  value: unknown,
  location: string,
  path: string,
): void {
  const resources = object(value, location, path)
  for (const [name, quantity] of Object.entries(resources)) {
    if (
      (typeof quantity !== 'string' || quantity.length === 0) &&
      typeof quantity !== 'number'
    ) {
      fail(location, `${path}.${name}`, 'must be a resource quantity')
    }
  }
}

function validateContainers(
  value: unknown,
  location: string,
  path: string,
  volumeNames = new Set<string>(),
): void {
  for (const [index, entry] of array(value, location, path).entries()) {
    const containerPath = `${path}[${index}]`
    const container = object(entry, location, containerPath)
    string(container.name, location, `${containerPath}.name`)
    string(container.image, location, `${containerPath}.image`)

    if (container.ports !== undefined) {
      for (const [portIndex, portValue] of array(
        container.ports,
        location,
        `${containerPath}.ports`,
      ).entries()) {
        const portPath = `${containerPath}.ports[${portIndex}]`
        const port = object(portValue, location, portPath)
        if (!Number.isInteger(port.containerPort) || Number(port.containerPort) < 1) {
          fail(location, `${portPath}.containerPort`, 'must be a positive integer')
        }
        optionalString(port.name, location, `${portPath}.name`)
      }
    }

    if (container.resources !== undefined) {
      const resources = object(
        container.resources,
        location,
        `${containerPath}.resources`,
      )
      if (resources.requests !== undefined) {
        validateResourceValues(
          resources.requests,
          location,
          `${containerPath}.resources.requests`,
        )
      }
      if (resources.limits !== undefined) {
        validateResourceValues(
          resources.limits,
          location,
          `${containerPath}.resources.limits`,
        )
      }
    }

    if (container.volumeMounts !== undefined) {
      for (const [mountIndex, mountValue] of array(
        container.volumeMounts,
        location,
        `${containerPath}.volumeMounts`,
      ).entries()) {
        const mountPath = `${containerPath}.volumeMounts[${mountIndex}]`
        const mount = object(mountValue, location, mountPath)
        const name = string(mount.name, location, `${mountPath}.name`)
        string(mount.mountPath, location, `${mountPath}.mountPath`)
        if (!volumeNames.has(name)) {
          fail(location, `${mountPath}.name`, `references missing volume ${name}`)
        }
      }
    }
  }
}

function validateVolumes(
  value: unknown,
  location: string,
  path: string,
): Set<string> {
  if (value === undefined) return new Set()

  const names = new Set<string>()
  for (const [index, entry] of array(value, location, path).entries()) {
    const volumePath = `${path}[${index}]`
    const volume = object(entry, location, volumePath)
    const name = string(volume.name, location, `${volumePath}.name`)
    if (names.has(name)) fail(location, `${volumePath}.name`, 'must be unique')
    names.add(name)

    const sourceNames = [
      'configMap',
      'emptyDir',
      'persistentVolumeClaim',
      'projected',
      'secret',
    ].filter((source) => volume[source] !== undefined)
    if (sourceNames.length !== 1) {
      fail(location, volumePath, 'must define exactly one validated volume source')
    }

    const sourceName = sourceNames[0]
    const source = object(volume[sourceName], location, `${volumePath}.${sourceName}`)
    if (sourceName === 'persistentVolumeClaim') {
      string(source.claimName, location, `${volumePath}.${sourceName}.claimName`)
    }
    if (sourceName === 'configMap' || sourceName === 'secret') {
      string(source.name ?? source.secretName, location, `${volumePath}.${sourceName}.name`)
    }
    if (sourceName === 'projected') {
      array(source.sources, location, `${volumePath}.projected.sources`)
    }
  }
  return names
}

function validatePodSpec(
  value: unknown,
  location: string,
  path: string,
  context: PodSpecContext,
): void {
  const spec = object(value, location, path)
  const volumeNames = validateVolumes(spec.volumes, location, `${path}.volumes`)
  validateContainers(spec.containers, location, `${path}.containers`, volumeNames)
  optionalString(spec.serviceAccountName, location, `${path}.serviceAccountName`)
  const allowedRestartPolicies: Record<PodSpecContext, string[]> = {
    deployment: ['Always'],
    job: ['Never', 'OnFailure'],
    pod: ['Always', 'Never', 'OnFailure'],
  }
  if (context === 'job' && spec.restartPolicy === undefined) {
    fail(location, `${path}.restartPolicy`, 'is required for a Job Pod template')
  }
  if (spec.restartPolicy !== undefined) {
    const restartPolicy = string(
      spec.restartPolicy,
      location,
      `${path}.restartPolicy`,
    )
    if (!allowedRestartPolicies[context].includes(restartPolicy)) {
      fail(
        location,
        `${path}.restartPolicy`,
        `must be one of ${allowedRestartPolicies[context].join(', ')} for ${context}`,
      )
    }
  }
}

function validateDeployment(manifest: JsonObject, location: string): void {
  const spec = object(manifest.spec, location, 'spec')
  const selector = object(spec.selector, location, 'spec.selector')
  const matchLabels = labels(
    selector.matchLabels,
    location,
    'spec.selector.matchLabels',
  )
  if (Object.keys(matchLabels).length === 0) {
    fail(location, 'spec.selector.matchLabels', 'must not be empty')
  }
  const template = object(spec.template, location, 'spec.template')
  const metadata = object(template.metadata, location, 'spec.template.metadata')
  const templateLabels = labels(
    metadata.labels,
    location,
    'spec.template.metadata.labels',
  )
  for (const [key, value] of Object.entries(matchLabels)) {
    if (templateLabels[key] !== value) {
      fail(location, 'spec.selector.matchLabels', `does not match template label ${key}`)
    }
  }
  validatePodSpec(template.spec, location, 'spec.template.spec', 'deployment')
}

function validateService(manifest: JsonObject, location: string): void {
  const spec = object(manifest.spec, location, 'spec')
  if (spec.selector !== undefined) {
    labels(spec.selector, location, 'spec.selector')
  }
  for (const [index, entry] of array(spec.ports, location, 'spec.ports').entries()) {
    const path = `spec.ports[${index}]`
    const port = object(entry, location, path)
    if (!Number.isInteger(port.port) || Number(port.port) < 1) {
      fail(location, `${path}.port`, 'must be a positive integer')
    }
    optionalString(port.name, location, `${path}.name`)
    if (
      port.targetPort !== undefined &&
      typeof port.targetPort !== 'string' &&
      !Number.isInteger(port.targetPort)
    ) {
      fail(location, `${path}.targetPort`, 'must be a name or integer')
    }
  }
}

function validateKeyValueData(
  value: unknown,
  location: string,
  path: string,
): void {
  const data = object(value, location, path)
  for (const [key, entry] of Object.entries(data)) {
    string(key, location, `${path} key`)
    string(entry, location, `${path}.${key}`)
  }
}

function validateConfigMap(manifest: JsonObject, location: string): void {
  if (manifest.data === undefined && manifest.binaryData === undefined) {
    fail(location, 'data', 'or binaryData must be present in this example')
  }
  if (manifest.data !== undefined) validateKeyValueData(manifest.data, location, 'data')
  if (manifest.binaryData !== undefined) {
    validateKeyValueData(manifest.binaryData, location, 'binaryData')
  }
}

function validateSecret(manifest: JsonObject, location: string): void {
  if (manifest.data === undefined && manifest.stringData === undefined) {
    fail(location, 'data', 'or stringData must be present')
  }
  if (manifest.data !== undefined) validateKeyValueData(manifest.data, location, 'data')
  if (manifest.stringData !== undefined) {
    validateKeyValueData(manifest.stringData, location, 'stringData')
  }
}

function validatePvc(manifest: JsonObject, location: string): void {
  const spec = object(manifest.spec, location, 'spec')
  const modes = stringArray(spec.accessModes, location, 'spec.accessModes')
  const allowedModes = new Set([
    'ReadOnlyMany',
    'ReadWriteMany',
    'ReadWriteOnce',
    'ReadWriteOncePod',
  ])
  for (const mode of modes) {
    if (!allowedModes.has(mode)) fail(location, 'spec.accessModes', `contains ${mode}`)
  }
  const resources = object(spec.resources, location, 'spec.resources')
  const requests = object(resources.requests, location, 'spec.resources.requests')
  string(requests.storage, location, 'spec.resources.requests.storage')
}

function validateRole(manifest: JsonObject, location: string): void {
  for (const [index, entry] of array(manifest.rules, location, 'rules').entries()) {
    const path = `rules[${index}]`
    const rule = object(entry, location, path)
    for (const [groupIndex, group] of array(
      rule.apiGroups,
      location,
      `${path}.apiGroups`,
    ).entries()) {
      if (typeof group !== 'string') {
        fail(location, `${path}.apiGroups[${groupIndex}]`, 'must be a string')
      }
    }
    stringArray(rule.resources, location, `${path}.resources`)
    stringArray(rule.verbs, location, `${path}.verbs`)
  }
}

function validateRoleBinding(manifest: JsonObject, location: string): void {
  for (const [index, entry] of array(
    manifest.subjects,
    location,
    'subjects',
  ).entries()) {
    const path = `subjects[${index}]`
    const subject = object(entry, location, path)
    const kind = string(subject.kind, location, `${path}.kind`)
    if (!['Group', 'ServiceAccount', 'User'].includes(kind)) {
      fail(location, `${path}.kind`, 'must be User, Group, or ServiceAccount')
    }
    string(subject.name, location, `${path}.name`)
    optionalString(subject.namespace, location, `${path}.namespace`)
  }
  const roleRef = object(manifest.roleRef, location, 'roleRef')
  if (roleRef.apiGroup !== 'rbac.authorization.k8s.io') {
    fail(location, 'roleRef.apiGroup', 'must be rbac.authorization.k8s.io')
  }
  if (!['ClusterRole', 'Role'].includes(String(roleRef.kind))) {
    fail(location, 'roleRef.kind', 'must be Role or ClusterRole')
  }
  string(roleRef.name, location, 'roleRef.name')
}

function validateJobSpec(
  value: unknown,
  location: string,
  path: string,
): void {
  const jobSpec = object(value, location, path)
  const template = object(jobSpec.template, location, `${path}.template`)
  validatePodSpec(
    template.spec,
    location,
    `${path}.template.spec`,
    'job',
  )
}

function validateJob(manifest: JsonObject, location: string): void {
  validateJobSpec(manifest.spec, location, 'spec')
}

function validateCronJob(manifest: JsonObject, location: string): void {
  const spec = object(manifest.spec, location, 'spec')
  string(spec.schedule, location, 'spec.schedule')
  const jobTemplate = object(spec.jobTemplate, location, 'spec.jobTemplate')
  validateJobSpec(jobTemplate.spec, location, 'spec.jobTemplate.spec')
}

function validateIngress(manifest: JsonObject, location: string): void {
  const spec = object(manifest.spec, location, 'spec')
  for (const [ruleIndex, ruleValue] of array(
    spec.rules,
    location,
    'spec.rules',
  ).entries()) {
    const rulePath = `spec.rules[${ruleIndex}]`
    const rule = object(ruleValue, location, rulePath)
    optionalString(rule.host, location, `${rulePath}.host`)
    const http = object(rule.http, location, `${rulePath}.http`)
    for (const [pathIndex, pathValue] of array(
      http.paths,
      location,
      `${rulePath}.http.paths`,
    ).entries()) {
      const path = `${rulePath}.http.paths[${pathIndex}]`
      const route = object(pathValue, location, path)
      string(route.path, location, `${path}.path`)
      string(route.pathType, location, `${path}.pathType`)
      const backend = object(route.backend, location, `${path}.backend`)
      const service = object(backend.service, location, `${path}.backend.service`)
      string(service.name, location, `${path}.backend.service.name`)
      const port = object(service.port, location, `${path}.backend.service.port`)
      if (port.name === undefined && port.number === undefined) {
        fail(location, `${path}.backend.service.port`, 'must set name or number')
      }
      optionalString(port.name, location, `${path}.backend.service.port.name`)
      if (port.number !== undefined && !Number.isInteger(port.number)) {
        fail(location, `${path}.backend.service.port.number`, 'must be an integer')
      }
    }
  }
}

function validateNetworkPolicy(manifest: JsonObject, location: string): void {
  const spec = object(manifest.spec, location, 'spec')
  object(spec.podSelector, location, 'spec.podSelector')
  if (spec.policyTypes !== undefined) {
    const policyTypes = stringArray(spec.policyTypes, location, 'spec.policyTypes')
    for (const policyType of policyTypes) {
      if (!['Egress', 'Ingress'].includes(policyType)) {
        fail(location, 'spec.policyTypes', `contains ${policyType}`)
      }
    }
  }
  for (const direction of ['egress', 'ingress']) {
    if (spec[direction] === undefined) continue
    for (const [index, rule] of possiblyEmptyArray(
      spec[direction],
      location,
      `spec.${direction}`,
    ).entries()) {
      object(rule, location, `spec.${direction}[${index}]`)
    }
  }
}

function validatePdb(manifest: JsonObject, location: string): void {
  const spec = object(manifest.spec, location, 'spec')
  const availabilityFields = ['maxUnavailable', 'minAvailable'].filter(
    (field) => spec[field] !== undefined,
  )
  if (availabilityFields.length !== 1) {
    fail(location, 'spec', 'must set exactly one of minAvailable or maxUnavailable')
  }
  const selector = object(spec.selector, location, 'spec.selector')
  if (selector.matchLabels !== undefined) {
    labels(selector.matchLabels, location, 'spec.selector.matchLabels')
  }
  if (selector.matchExpressions !== undefined) {
    possiblyEmptyArray(
      selector.matchExpressions,
      location,
      'spec.selector.matchExpressions',
    )
  }
}

const validators: Record<string, { apiVersion: string; validate: Validator }> = {
  ConfigMap: { apiVersion: 'v1', validate: validateConfigMap },
  CronJob: { apiVersion: 'batch/v1', validate: validateCronJob },
  Deployment: { apiVersion: 'apps/v1', validate: validateDeployment },
  Ingress: { apiVersion: 'networking.k8s.io/v1', validate: validateIngress },
  Job: { apiVersion: 'batch/v1', validate: validateJob },
  Namespace: { apiVersion: 'v1', validate: () => undefined },
  NetworkPolicy: {
    apiVersion: 'networking.k8s.io/v1',
    validate: validateNetworkPolicy,
  },
  Pod: {
    apiVersion: 'v1',
    validate: (manifest, location) =>
      validatePodSpec(manifest.spec, location, 'spec', 'pod'),
  },
  PodDisruptionBudget: { apiVersion: 'policy/v1', validate: validatePdb },
  PersistentVolumeClaim: { apiVersion: 'v1', validate: validatePvc },
  Role: { apiVersion: 'rbac.authorization.k8s.io/v1', validate: validateRole },
  RoleBinding: {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    validate: validateRoleBinding,
  },
  Secret: { apiVersion: 'v1', validate: validateSecret },
  Service: { apiVersion: 'v1', validate: validateService },
  ServiceAccount: { apiVersion: 'v1', validate: () => undefined },
}

export function validateKubernetesManifest(
  value: unknown,
  location = 'manifest',
): void {
  const manifest = object(value, location, 'document')
  const apiVersion = string(manifest.apiVersion, location, 'apiVersion')
  const kind = string(manifest.kind, location, 'kind')
  const metadata = object(manifest.metadata, location, 'metadata')
  string(metadata.name, location, 'metadata.name')
  optionalString(metadata.namespace, location, 'metadata.namespace')

  const validator = validators[kind]
  if (!validator) {
    fail(location, 'kind', `has unknown or unvalidated kind ${kind}`)
  }
  if (validator.apiVersion !== apiVersion) {
    fail(
      location,
      'apiVersion',
      `must be ${validator.apiVersion} for ${kind} at ${KUBERNETES_SCHEMA_TARGET}`,
    )
  }
  validator.validate(manifest, location)
}
