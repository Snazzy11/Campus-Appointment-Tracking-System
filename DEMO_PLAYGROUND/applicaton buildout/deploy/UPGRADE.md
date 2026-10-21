# Existing EC2 instance upgrade plan

This is a plan, not authorization to stop or modify the live instance. No AWS changes have been made.

## Evidence and proposed capacity

Inventory supplied on October 12, 2026: aarch64; 1.8 GiB reported RAM; 1.2 GiB used; 572 MiB available; 1 GiB of 2 GiB swap used; 38 GiB disk available; Docker 29.2.1 and Compose v5.0.2 installed. Host Nginx already owns ports 80/443; 18080 was not listed. Existing workload includes multiple Docker services plus mail/directory services. This is less RAM than the initially stated 4 GB.

The user chose to plan an upgrade of this same instance. Selected upgrade: **t4g.medium (4 GiB RAM, 2 vCPUs)**. Reported stable public address: **3.21.213.171**; its Elastic IP association still needs verification in EC2 before stop/start. The user has chosen the target size. Pending: current instance type, region, compatibility/EBS backing, maintenance window, and existing backup/recovery process.

Use the selected ARM **t4g.medium** after verifying compatibility in the EC2 console. This doubles the nominal memory from the reported approximately 2 GiB capacity. Recheck available RAM, swap activity, CPU credits, and application peaks after the upgrade before adding messaging. Container limits cap the new stack near 1 GiB, but they do not reserve memory for existing services. Review the displayed regional cost before applying the change.

## Before the maintenance window

1. Record instance ID, region/AZ, current type, EBS volumes, security groups, subnet/ENI, IAM instance profile, public/private addresses, and Elastic IP. Check whether an Auto Scaling group or other controller manages it; such a controller changes the resize workflow.
2. Confirm EBS backing and instance-type compatibility in EC2. Check root-volume encryption/key permissions and boot requirements. Check application licenses that may depend on hardware/addresses.
3. Record health checks for all critical services and a baseline of Docker containers, systemd units, Nginx config, mounted volumes, and startup policies. Docker restart policies and enabled systemd services must restore services on reboot; don't assume they do.
4. Use existing application-aware backup procedures for live databases, directory, and mail services. Take recoverable EBS snapshots/AMI as appropriate; snapshots taken while databases are actively writing are not substitutes for application-consistent backups. Verify the recovery route and enough disk capacity.
5. Verify that an Elastic IP is associated if public address stability is required. Without one, a stop/start changes the auto-assigned public IPv4 address; DNS, mail records, allowlists, and integrations may need updating. Do not allocate/associate an address without reviewing the impact and cost.
6. Choose a maintenance window and notify affected users through the normal human process. A stop/start interrupts all applications on this instance. Do not run app deployment or schema migrations in the same step as the capacity change.

## Concrete change during the approved window

Have console access available in case SSH does not return. Follow the existing applications' documented shutdown order, then stop the EBS-backed instance in EC2. When it is fully stopped, change only its instance type to **t4g.medium**, if confirmed compatible and start it again. Do not terminate it or replace disks/configuration.

Wait for EC2 status checks, confirm the address, reconnect SSH, check RAM and disk mounts, then verify every existing critical service and Nginx route. Stop here if any baseline service fails; do not add messaging until the server is stable.

Keep the maintenance window long enough for recovery: AWS documents variable restart time based on application startup, so do not promise a fixed outage duration. Review increased recurring instance cost before applying the change.

## Rollback

If the capacity change causes problems, diagnose boot/status checks and service logs first. Returning to the old compatible type requires another stop/start; restore backups only if needed and using the recovery procedure. The old type still has the original low-memory limitation, so don't deploy messaging after that rollback. Preserve snapshots and the prior instance settings until verification is complete.

## After the upgrade

Recheck free -h, CPU/credit pressure, swap activity, disk, Docker services, and listening ports under normal workload. Only then proceed with [EC2.md](EC2.md): upload the already tested ARM images, create the separate PostgreSQL database, validate on loopback, and add the new Nginx site. Existing configuration changes should remain limited to that separate site followed by nginx -t and graceful reload.

Sources: [AWS resize procedure and address/downtime considerations](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/change-instance-type-of-ebs-backed-instance.html), [AWS instance specifications](https://docs.aws.amazon.com/ec2/latest/instancetypes/gp.html).
